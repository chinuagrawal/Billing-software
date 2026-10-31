import { createHash } from 'node:crypto';
import type { DocumentReference, Firestore } from 'firebase-admin/firestore';
import type { Command, Workspace } from '../src/types.js';
import { applyCommand, fy } from '../src/lib/billing.js';
import { emptyWorkspace } from '../src/lib/seed.js';

export class CommandError extends Error {}

export async function executeServerCommand(
  database: Firestore,
  ownerId: string,
  requestId: string,
  command: Command,
) {
  if (!ownerId || ownerId.includes('/')) throw new CommandError('Invalid workspace owner.');
  const root = database.collection('workspaces').doc(ownerId);
  const commandHash = createHash('sha256').update(JSON.stringify(command)).digest('hex');
  return database.runTransaction(async (tx) => {
    const lifecycle = await tx.get(database.collection('accountLifecycle').doc(ownerId));
    if (lifecycle.exists)
      throw new CommandError('Account deletion has started. No further changes are allowed.');
    const receiptRef = root.collection('operations').doc(requestId);
    const receipt = await tx.get(receiptRef);
    if (receipt.exists) {
      if (receipt.data()?.commandHash !== commandHash)
        throw new CommandError(
          'This request was already used for a different change. Refresh before continuing.',
        );
      return { replayed: true };
    }
    const state = emptyWorkspace();
    const business = await tx.get(root.collection('settings').doc('business'));
    if (business.exists) state.business = business.data() as Workspace['business'];
    const currentCommand = structuredClone(command);
    const invoiceId =
      command.type === 'saveInvoice'
        ? command.invoice.id
        : command.type === 'payment'
          ? command.payment.invoiceId
          : command.type === 'void' || command.type === 'deleteDraft'
            ? command.id
            : null;
    if (invoiceId) {
      const invoice = await tx.get(root.collection('invoices').doc(invoiceId));
      if (invoice.exists) state.invoices = [invoice.data() as Workspace['invoices'][number]];
    }
    if (command.type === 'deleteDraft') {
      const linkedPayments = await tx.get(
        root.collection('payments').where('invoiceId', '==', command.id).limit(1),
      );
      state.payments = linkedPayments.docs.map(
        (doc) => doc.data() as Workspace['payments'][number],
      );
    }
    if (currentCommand.type === 'saveInvoice') {
      const customer = await tx.get(
        root.collection('customers').doc(currentCommand.invoice.customer.id),
      );
      if (customer.exists) state.customers = [customer.data() as Workspace['customers'][number]];
      const year = fy(currentCommand.invoice.date),
        counter = await tx.get(root.collection('counters').doc(year));
      state.counters[year] = counter.data()?.value || 0;
      currentCommand.invoice.createdAt = state.invoices[0]?.createdAt || new Date().toISOString();
    }
    if (command.type === 'payment') {
      const previous = await tx.get(root.collection('payments').doc(command.payment.id));
      if (previous.exists) state.payments = [previous.data() as Workspace['payments'][number]];
    }
    if (command.type === 'saveCustomer') {
      const previous = await tx.get(root.collection('customers').doc(command.customer.id));
      if (previous.exists) state.customers = [previous.data() as Workspace['customers'][number]];
    }
    if (command.type === 'purchase') {
      const previous = await tx.get(root.collection('purchases').doc(command.purchase.id));
      if (previous.exists)
        state.purchases = [previous.data() as NonNullable<Workspace['purchases']>[number]];
    }
    const productIds =
      command.type === 'saveInvoice'
        ? command.invoice.items.map((i) => i.productId)
        : command.type === 'void'
          ? state.invoices[0]?.items.map((i) => i.productId) || []
          : command.type === 'purchase'
            ? [command.purchase.productId]
            : command.type === 'stock'
              ? [command.id]
              : command.type === 'saveProduct'
                ? [command.product.id]
                : [];
    for (const id of new Set(productIds)) {
      const product = await tx.get(root.collection('products').doc(id));
      if (product.exists) state.products.push(product.data() as Workspace['products'][number]);
    }
    // A dedicated SKU reservation is read and written in the same transaction, so two
    // concurrent product creates cannot claim the same case-insensitive SKU.
    let skuRef: DocumentReference | undefined;
    if (command.type === 'saveProduct') {
      const skuKey = createHash('sha256')
        .update(command.product.sku.trim().toLowerCase())
        .digest('hex');
      skuRef = root.collection('skuIndex').doc(skuKey);
      const reservation = await tx.get(skuRef);
      if (reservation.exists && reservation.data()?.productId !== command.product.id)
        throw new CommandError('This SKU is already in use.');
    }
    let next: Workspace;
    try {
      next = applyCommand(state, currentCommand);
    } catch (error) {
      throw new CommandError((error as Error).message);
    }
    for (const name of [
      'customers',
      'products',
      'invoices',
      'payments',
      'audit',
      'purchases',
    ] as const) {
      for (const record of next[name] || []) {
        const old = (state[name] || []).find((x) => x.id === record.id);
        if (JSON.stringify(record) !== JSON.stringify(old))
          tx.set(root.collection(name).doc(record.id), record);
      }
    }
    if (command.type === 'saveBusiness')
      tx.set(root.collection('settings').doc('business'), next.business);
    if (command.type === 'deleteDraft') tx.delete(root.collection('invoices').doc(command.id));
    for (const [key, value] of Object.entries(next.counters))
      if (value !== state.counters[key]) tx.set(root.collection('counters').doc(key), { value });
    if (skuRef && command.type === 'saveProduct') tx.set(skuRef, { productId: command.product.id });
    tx.create(receiptRef, { commandHash, at: new Date().toISOString(), type: command.type });
    return { replayed: false };
  });
}
