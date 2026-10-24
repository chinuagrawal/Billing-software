import type { Invoice, LineItem, Workspace, Command, Business } from '../types';

export const STATES: Record<string, string> = {
  '01': 'Jammu and Kashmir',
  '02': 'Himachal Pradesh',
  '03': 'Punjab',
  '04': 'Chandigarh',
  '05': 'Uttarakhand',
  '06': 'Haryana',
  '07': 'Delhi',
  '08': 'Rajasthan',
  '09': 'Uttar Pradesh',
  '10': 'Bihar',
  '11': 'Sikkim',
  '12': 'Arunachal Pradesh',
  '13': 'Nagaland',
  '14': 'Manipur',
  '15': 'Mizoram',
  '16': 'Tripura',
  '17': 'Meghalaya',
  '18': 'Assam',
  '19': 'West Bengal',
  '20': 'Jharkhand',
  '21': 'Odisha',
  '22': 'Chhattisgarh',
  '23': 'Madhya Pradesh',
  '24': 'Gujarat',
  '26': 'Dadra and Nagar Haveli and Daman and Diu',
  '27': 'Maharashtra',
  '29': 'Karnataka',
  '30': 'Goa',
  '31': 'Lakshadweep',
  '32': 'Kerala',
  '33': 'Tamil Nadu',
  '34': 'Puducherry',
  '35': 'Andaman and Nicobar Islands',
  '36': 'Telangana',
  '37': 'Andhra Pradesh',
  '38': 'Ladakh',
};
export const money = (n: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(n);
export const compactMoney = (n: number) =>
  n >= 100000
    ? `₹${(n / 100000).toFixed(2)}L`
    : n >= 1000
      ? `₹${(n / 1000).toFixed(1)}k`
      : money(n);
export const round = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
export const today = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
export const dateLabel = (d: string) =>
  new Date(`${d}T12:00:00`).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
export const uid = () => crypto.randomUUID();
export const fy = (date: string) => {
  const [year, month] = date.split('-').map(Number);
  const start = month >= 4 ? year : year - 1;
  return `${String(start).slice(2)}-${String(start + 1).slice(2)}`;
};
export function totals(items: LineItem[], interstate: boolean) {
  let subtotal = 0,
    discount = 0,
    taxable = 0,
    cgst = 0,
    sgst = 0,
    igst = 0;
  for (const item of items) {
    const gross = round(item.qty * item.price),
      deduction = round((gross * item.discount) / 100),
      base = round(gross - deduction);
    subtotal += gross;
    discount += deduction;
    taxable += base;
    if (interstate) igst += round((base * item.gst) / 100);
    else {
      cgst += round((base * item.gst) / 200);
      sgst += round((base * item.gst) / 200);
    }
  }
  return {
    subtotal: round(subtotal),
    discount: round(discount),
    taxable: round(taxable),
    cgst: round(cgst),
    sgst: round(sgst),
    igst: round(igst),
    tax: round(cgst + sgst + igst),
    total: round(taxable + cgst + sgst + igst),
  };
}
export const invoiceTotals = (i: Invoice) => totals(i.items, i.business.state !== i.placeOfSupply);
export function invoiceProfit(i: Invoice) {
  if (i.status !== 'issued' || i.items.some((x) => x.costTotal === undefined)) return null;
  const cost = round(i.items.reduce((sum, x) => sum + x.costTotal!, 0));
  const sales = invoiceTotals(i).taxable;
  return { cost, sales, profit: round(sales - cost) };
}
export const balance = (i: Invoice) =>
  i.status === 'issued' ? round(invoiceTotals(i).total - i.paid) : 0;
export const status = (i: Invoice) =>
  i.status === 'draft'
    ? 'Draft'
    : i.status === 'void'
      ? 'Void'
      : balance(i) <= 0
        ? 'Paid'
        : i.dueDate < today()
          ? 'Overdue'
          : i.paid > 0
            ? 'Partially paid'
            : 'Unpaid';
export function validGstin(gstin: string) {
  if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(gstin) || !STATES[gstin.slice(0, 2)])
    return false;
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let sum = 0;
  for (let n = 0; n < 14; n++) {
    const value = chars.indexOf(gstin[n]) * (n % 2 === 0 ? 1 : 2);
    sum += Math.floor(value / 36) + (value % 36);
  }
  return chars[(36 - (sum % 36)) % 36] === gstin[14];
}
function insist(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
const finite = (n: number) => Number.isFinite(n);
export function businessSetupError(b: Business): string {
  if (!b.name.trim()) return 'Enter your registered business name.';
  if (!STATES[b.state]) return 'Select your business state.';
  if (!validGstin(b.gstin) || b.gstin.slice(0, 2) !== b.state)
    return 'Enter a valid GSTIN matching your business state.';
  if (!b.address.trim()) return 'Enter your registered address.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.email)) return 'Enter a valid business email.';
  if (!/^\+?\d{10,15}$/.test(b.phone.replace(/[\s()-]/g, '')))
    return 'Enter a valid business phone number.';
  if (!/^[A-Z0-9-]{1,5}$/.test(b.prefix))
    return 'Choose an invoice prefix of 1–5 uppercase letters, numbers or hyphens.';
  if (
    (b.bankName || b.account || b.ifsc) &&
    !(b.bankName.trim() && b.account.trim() && /^[A-Z]{4}0[A-Z0-9]{6}$/.test(b.ifsc))
  )
    return 'Complete the bank name, account number and valid IFSC, or leave all bank fields empty.';
  return '';
}
export function applyCommand(current: Workspace, command: Command): Workspace {
  const state = structuredClone(current);
  const log = (action: string, detail: string) =>
    state.audit.unshift({ id: uid(), action, detail, at: new Date().toISOString() });
  if (command.type === 'saveBusiness') {
    const b = command.business;
    insist(
      !b.invoiceTemplate || ['classic', 'modern', 'minimal'].includes(b.invoiceTemplate),
      'Choose a valid invoice style.',
    );
    if (b.setupCompleted) {
      const problem = businessSetupError(b);
      insist(!problem, problem);
    }
    insist(b.name.trim() && STATES[b.state], 'Business name and state are required.');
    insist(
      /^[A-Z0-9-]{1,5}$/.test(b.prefix),
      'Invoice prefix must contain 1–5 uppercase letters, numbers or hyphens.',
    );
    insist(
      !b.gstin || (validGstin(b.gstin) && b.gstin.slice(0, 2) === b.state),
      'Enter a valid GSTIN matching your business state.',
    );
    state.business = b;
    log('Business updated', b.name);
  }
  if (command.type === 'saveCustomer') {
    const c = command.customer;
    insist(c.name.trim() && STATES[c.state], 'Customer name and state are required.');
    insist(
      c.type !== 'B2B' || (validGstin(c.gstin) && c.gstin.slice(0, 2) === c.state),
      'A B2B customer needs a valid GSTIN matching their state.',
    );
    insist(c.type !== 'B2C' || !c.gstin, 'Use B2B for GST-registered customers.');
    state.customers = [c, ...state.customers.filter((x) => x.id !== c.id)];
    log('Customer saved', c.name);
  }
  if (command.type === 'saveProduct') {
    const p = command.product,
      old = state.products.find((x) => x.id === p.id);
    insist(
      p.name.trim() && p.sku.trim() && /^\d{4,8}$/.test(p.hsn),
      'Name, SKU and a 4–8 digit HSN/SAC are required.',
    );
    insist(
      [p.price, p.cost, p.stock, p.lowStock, p.gst].every((n) => finite(n) && n >= 0) &&
        p.gst <= 100,
      'Product values must be valid positive numbers.',
    );
    insist(
      !state.products.some((x) => x.id !== p.id && x.sku.toLowerCase() === p.sku.toLowerCase()),
      'This SKU is already in use.',
    );
    state.products = [
      { ...p, cost: old?.cost ?? p.cost, stock: old?.stock ?? p.stock },
      ...state.products.filter((x) => x.id !== p.id),
    ];
    log('Product saved', p.name);
  }
  if (command.type === 'purchase') {
    const purchase = command.purchase;
    const p = state.products.find((x) => x.id === purchase.productId);
    insist(
      p &&
        finite(purchase.quantity) &&
        purchase.quantity > 0 &&
        finite(purchase.unitCost) &&
        purchase.unitCost >= 0,
      'Enter a valid purchase quantity and unit cost.',
    );
    insist(
      /^\d{4}-\d{2}-\d{2}$/.test(purchase.date) && purchase.date <= today(),
      'Choose a purchase date no later than today.',
    );
    insist(
      !(state.purchases || []).some((x) => x.id === purchase.id),
      'This purchase has already been recorded.',
    );
    const newStock = round(p.stock + purchase.quantity);
    insist(
      newStock > p.stock && Number.isSafeInteger(Math.round(newStock * purchase.unitCost * 100)),
      'Purchase exceeds supported quantity or value.',
    );
    p.cost =
      Math.round(
        ((p.stock * p.cost + purchase.quantity * purchase.unitCost) / newStock) * 1000000,
      ) / 1000000;
    p.stock = newStock;
    state.purchases = [structuredClone(purchase), ...(state.purchases || [])];
    log(
      'Purchase received',
      `${p.name}: +${purchase.quantity} at ${money(purchase.unitCost)} · ${purchase.reference}`,
    );
  }
  if (command.type === 'stock') {
    const p = state.products.find((x) => x.id === command.id);
    insist(
      p &&
        finite(command.quantity) &&
        command.quantity !== 0 &&
        p.stock + command.quantity >= 0 &&
        command.reason.trim(),
      'Enter a valid stock change and reason. Stock cannot become negative.',
    );
    p.stock = round(p.stock + command.quantity);
    log(
      'Stock adjusted',
      `${p.name}: ${command.quantity > 0 ? '+' : ''}${command.quantity} · ${command.reason}`,
    );
  }
  if (command.type === 'saveInvoice') {
    const i = structuredClone(command.invoice),
      existing = state.invoices.find((x) => x.id === i.id);
    insist(!existing || existing.status === 'draft', 'An issued invoice cannot be edited.');
    const customer = state.customers.find((c) => c.id === i.customer.id);
    insist(customer, 'Select a customer.');
    i.customer = structuredClone(customer);
    insist(i.items.length > 0 && i.items.length <= 50, 'Add between 1 and 50 invoice items.');
    insist(
      i.date && i.dueDate >= i.date && i.date <= today(),
      'Invoice date cannot be in the future; due date must follow invoice date.',
    );
    insist(STATES[i.placeOfSupply], 'Select a valid place of supply.');
    for (const item of i.items)
      insist(
        item.name &&
          /^\d{4,8}$/.test(item.hsn) &&
          [item.qty, item.price, item.discount, item.gst].every(finite) &&
          item.qty > 0 &&
          item.price >= 0 &&
          item.discount >= 0 &&
          item.discount <= 100 &&
          item.gst >= 0 &&
          item.gst <= 100,
        'Check item quantities, prices, HSN and tax rates.',
      );
    insist(
      i.items.every((item) => Number.isSafeInteger(Math.round(item.qty * item.price * 100))) &&
        Number.isSafeInteger(Math.round(invoiceTotals(i).total * 100)),
      'Invoice value exceeds the supported currency precision.',
    );
    i.business = structuredClone(state.business);
    i.paid = 0;
    i.items.forEach((item) => {
      delete item.costTotal;
    });
    if (command.issue) {
      insist(
        validGstin(i.business.gstin) &&
          i.business.gstin.slice(0, 2) === i.business.state &&
          i.business.address.trim(),
        'Add your valid GSTIN and business address in Settings before issuing a tax invoice.',
      );
      insist(i.customer.address.trim(), 'Add the customer billing address before issuing.');
      insist(
        i.customer.type !== 'B2B' || validGstin(i.customer.gstin),
        'A valid customer GSTIN is required for B2B.',
      );
      const quantities = new Map<string, number>();
      i.items.forEach((x) =>
        quantities.set(x.productId, (quantities.get(x.productId) || 0) + x.qty),
      );
      for (const [id, qty] of quantities) {
        const p = state.products.find((x) => x.id === id);
        insist(p && p.stock >= qty, `Insufficient stock for ${p?.name || 'a removed product'}.`);
        p.stock = round(p.stock - qty);
      }
      i.items.forEach((item) => {
        const p = state.products.find((x) => x.id === item.productId)!;
        item.costTotal = round(item.qty * p.cost);
      });
      const financialYear = fy(i.date),
        next = (state.counters[financialYear] || 0) + 1;
      insist(next <= 99999, 'Invoice sequence limit reached for this financial year.');
      i.number = `${i.business.prefix}/${financialYear}/${String(next).padStart(4, '0')}`;
      insist(
        i.number.length <= 16,
        'Invoice number exceeds 16 characters. Shorten your invoice prefix in Settings.',
      );
      state.counters[financialYear] = next;
      i.status = 'issued';
      log('Invoice issued', `${i.number} · ${i.customer.name}`);
    } else {
      i.status = 'draft';
      i.number = 'DRAFT';
      log('Draft saved', i.customer.name);
    }
    state.invoices = [i, ...state.invoices.filter((x) => x.id !== i.id)];
  }
  if (command.type === 'payment') {
    const p = command.payment,
      i = state.invoices.find((x) => x.id === p.invoiceId);
    insist(i && i.status === 'issued', 'Payments can only be recorded against issued invoices.');
    insist(!state.payments.some((x) => x.id === p.id), 'This payment has already been recorded.');
    insist(
      finite(p.amount) && round(p.amount) > 0 && round(p.amount) <= balance(i),
      'Payment must be greater than zero and cannot exceed the balance.',
    );
    insist(
      p.date >= i.date && p.date <= today(),
      'Payment date must be between the invoice date and today.',
    );
    i.paid = round(i.paid + round(p.amount));
    state.payments.unshift({
      ...p,
      amount: round(p.amount),
      invoiceNumber: i.number,
      customerName: i.customer.name,
    });
    log('Payment received', `${i.number} · ${money(p.amount)}`);
  }
  if (command.type === 'void') {
    const i = state.invoices.find((x) => x.id === command.id);
    insist(
      i && i.status === 'issued' && i.paid === 0,
      'Only unpaid issued invoices can be voided. Paid invoices need a credit-note/refund workflow.',
    );
    i.status = 'void';
    i.items.forEach((item) => {
      const p = state.products.find((x) => x.id === item.productId);
      if (p) {
        const restored = round(p.stock + item.qty);
        p.cost =
          Math.round(
            ((p.stock * p.cost + (item.costTotal ?? item.qty * p.cost)) / restored) * 1000000,
          ) / 1000000;
        p.stock = restored;
      }
    });
    log('Invoice voided', `${i.number} · stock restored`);
  }
  return state;
}
export function download(name: string, content: string, type = 'text/csv;charset=utf-8') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function csv(rows: (string | number)[][]) {
  return (
    '\uFEFF' +
    rows
      .map((row) =>
        row
          .map((value) => {
            let s = String(value);
            if (/^[=+@\-\t\r]/.test(s)) s = `'${s}`;
            return `"${s.replaceAll('"', '""')}"`;
          })
          .join(','),
      )
      .join('\r\n')
  );
}
