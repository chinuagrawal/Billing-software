import { describe, expect, it } from 'vitest';
import type { Firestore } from 'firebase-admin/firestore';
import { executeServerCommand } from './commands';
import { defaultBusiness } from '../src/lib/seed';
import type { Command, Product } from '../src/types';
import { demoWorkspace } from '../src/lib/seed';

function databaseFixture() {
  const records = new Map<string, unknown>();
  const ref = (path: string): unknown => ({
    path,
    collection: (name: string) => ({
      doc: (id: string) => ref(`${path}/${name}/${id}`),
      where: (field: string, _operator: string, value: unknown) => ({
        limit: () => ({ path: `${path}/${name}`, filter: { field, value } }),
      }),
    }),
  });
  const database = {
    collection: (name: string) => ({ doc: (id: string) => ref(`${name}/${id}`) }),
    runTransaction: async (work: (transaction: unknown) => Promise<unknown>) => {
      const staged = new Map(records);
      const transaction = {
        get: async (reference: { path: string; filter?: { field: string; value: unknown } }) =>
          reference.filter
            ? {
                docs: [...records.entries()]
                  .filter(
                    ([path, value]) =>
                      path.startsWith(reference.path + '/') &&
                      (value as Record<string, unknown>)[reference.filter!.field] ===
                        reference.filter!.value,
                  )
                  .slice(0, 1)
                  .map(([, value]) => ({ data: () => structuredClone(value) })),
              }
            : {
                exists: records.has(reference.path),
                data: () => structuredClone(records.get(reference.path)),
              },
        set: (reference: { path: string }, value: unknown) =>
          staged.set(reference.path, structuredClone(value)),
        delete: (reference: { path: string }) => staged.delete(reference.path),
        create: (reference: { path: string }, value: unknown) => {
          if (records.has(reference.path)) throw new Error('Already exists');
          staged.set(reference.path, structuredClone(value));
        },
      };
      const result = await work(transaction);
      records.clear();
      for (const [key, value] of staged) records.set(key, value);
      return result;
    },
  } as unknown as Firestore;
  return { database, records };
}
const product: Product = {
  id: 'p1',
  name: 'Tote',
  sku: 'TOTE-1',
  category: 'Bags',
  hsn: '420222',
  price: 500,
  cost: 200,
  gst: 18,
  stock: 10,
  lowStock: 2,
  unit: 'PCS',
  color: 'sage',
};
describe('trusted server commands', () => {
  it('deletes only the owner draft, audits it and safely replays the request', async () => {
    const { database, records } = databaseFixture();
    const draft = {
      ...demoWorkspace().invoices[0],
      id: 'draft1',
      status: 'draft' as const,
      number: 'DRAFT',
      paid: 0,
    };
    records.set('workspaces/owner/invoices/draft1', draft);
    records.set('workspaces/other/invoices/draft1', draft);
    const command: Command = { type: 'deleteDraft', id: 'draft1' };
    await executeServerCommand(database, 'owner', 'delete-1', command);
    expect(records.has('workspaces/owner/invoices/draft1')).toBe(false);
    expect(records.has('workspaces/other/invoices/draft1')).toBe(true);
    expect([...records.keys()].filter((k) => k.includes('/audit/'))).toHaveLength(1);
    expect(await executeServerCommand(database, 'owner', 'delete-1', command)).toEqual({
      replayed: true,
    });
  });
  it('rejects deletion of issued, void, absent, paid or payment-linked drafts without writes', async () => {
    for (const variant of ['issued', 'void', 'missing', 'paid', 'linked']) {
      const { database, records } = databaseFixture();
      const draft = {
        ...demoWorkspace().invoices[0],
        id: 'draft1',
        status:
          variant === 'issued'
            ? ('issued' as const)
            : variant === 'void'
              ? ('void' as const)
              : ('draft' as const),
        paid: variant === 'paid' ? 100 : 0,
      };
      if (variant !== 'missing') records.set('workspaces/owner/invoices/draft1', draft);
      if (variant === 'linked')
        records.set('workspaces/owner/payments/pay1', { invoiceId: 'draft1' });
      const before = new Map(records);
      await expect(
        executeServerCommand(database, 'owner', 'delete-1', { type: 'deleteDraft', id: 'draft1' }),
      ).rejects.toThrow();
      expect(records).toEqual(before);
    }
  });
  it('writes only within the verified owner workspace', async () => {
    const { database, records } = databaseFixture();
    await executeServerCommand(database, 'verified-owner', 'request-1', {
      type: 'saveProduct',
      product,
    });
    expect(records.get('workspaces/verified-owner/products/p1')).toEqual(product);
    expect([...records.keys()].every((key) => key.startsWith('workspaces/verified-owner/'))).toBe(
      true,
    );
  });
  it('replays the same stock request without applying it twice', async () => {
    const { database, records } = databaseFixture();
    records.set('workspaces/owner/products/p1', product);
    const command: Command = { type: 'stock', id: 'p1', quantity: 5, reason: 'Purchase received' };
    expect(await executeServerCommand(database, 'owner', 'same-request', command)).toEqual({
      replayed: false,
    });
    expect(await executeServerCommand(database, 'owner', 'same-request', command)).toEqual({
      replayed: true,
    });
    expect((records.get('workspaces/owner/products/p1') as Product).stock).toBe(15);
    expect([...records.keys()].filter((key) => key.includes('/audit/'))).toHaveLength(1);
  });
  it('rejects reusing a request ID with different content', async () => {
    const { database } = databaseFixture();
    await executeServerCommand(database, 'owner', 'request-1', { type: 'saveProduct', product });
    await expect(
      executeServerCommand(database, 'owner', 'request-1', {
        type: 'saveProduct',
        product: { ...product, name: 'Different' },
      }),
    ).rejects.toThrow('different change');
  });
  it('reserves case-insensitive SKUs across product creations', async () => {
    const { database } = databaseFixture();
    await executeServerCommand(database, 'owner', 'request-1', { type: 'saveProduct', product });
    await expect(
      executeServerCommand(database, 'owner', 'request-2', {
        type: 'saveProduct',
        product: { ...product, id: 'p2', sku: 'tote-1' },
      }),
    ).rejects.toThrow('SKU');
  });
  it('commits no records when business validation fails', async () => {
    const { database, records } = databaseFixture();
    records.set('workspaces/owner/products/p1', product);
    await expect(
      executeServerCommand(database, 'owner', 'request-1', {
        type: 'stock',
        id: 'p1',
        quantity: -20,
        reason: 'Invalid',
      }),
    ).rejects.toThrow();
    expect(records.size).toBe(1);
    expect((records.get('workspaces/owner/products/p1') as Product).stock).toBe(10);
  });
  it('creates initial business settings even when they equal the default', async () => {
    const { database, records } = databaseFixture();
    const business = { ...defaultBusiness };
    await executeServerCommand(database, 'owner', 'request-1', { type: 'saveBusiness', business });
    expect(records.get('workspaces/owner/settings/business')).toEqual(business);
  });
  it('blocks all mutations after account deletion starts', async () => {
    const { database, records } = databaseFixture();
    records.set('accountLifecycle/owner', { status: 'deleting' });
    await expect(
      executeServerCommand(database, 'owner', 'request-1', { type: 'saveProduct', product }),
    ).rejects.toThrow('deletion');
    expect(records.size).toBe(1);
  });
});
