import { describe, it, expect } from 'vitest';
import {
  applyCommand,
  invoiceProfit,
  totals,
  fy,
  validGstin,
  balance,
  invoiceTotals,
  status,
  csv,
  today,
} from './billing';
import { emptyWorkspace, defaultBusiness } from './seed';
import type { Invoice, LineItem, Workspace } from '../types';
const line: LineItem = {
  productId: 'p1',
  name: 'Test product',
  hsn: '420222',
  unit: 'PCS',
  qty: 2,
  price: 1000,
  discount: 10,
  gst: 18,
};
function gst(prefix: string) {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let sum = 0;
  for (let n = 0; n < 14; n++) {
    const p = chars.indexOf(prefix[n]) * (n % 2 === 0 ? 1 : 2);
    sum += Math.floor(p / 36) + (p % 36);
  }
  return prefix + chars[(36 - (sum % 36)) % 36];
}
function fixture(): { state: Workspace; invoice: Invoice } {
  const state = emptyWorkspace();
  state.business = {
    ...defaultBusiness,
    gstin: gst('08ABCDE1234F1Z'),
    address: 'Jaipur, Rajasthan',
  };
  const customer = {
    id: 'c1',
    name: 'Test Customer',
    type: 'B2C' as const,
    email: '',
    phone: '',
    gstin: '',
    state: '08',
    address: 'Jaipur',
  };
  state.customers = [customer];
  state.products = [
    {
      id: 'p1',
      name: line.name,
      sku: 'TEST-1',
      hsn: line.hsn,
      category: 'Test',
      price: 1000,
      cost: 500,
      gst: 18,
      stock: 10,
      lowStock: 2,
      unit: 'PCS',
      color: 'sage',
    },
  ];
  return {
    state,
    invoice: {
      id: 'i1',
      number: 'DRAFT',
      customer,
      business: state.business,
      date: today(),
      dueDate: today(),
      placeOfSupply: '08',
      shippingAddress: 'Jaipur',
      reference: '',
      items: [{ ...line }],
      notes: '',
      status: 'draft',
      paid: 0,
      createdAt: new Date().toISOString(),
    },
  };
}
describe('GST and currency calculations', () => {
  it('splits local GST after discount', () => {
    expect(totals([line], false)).toEqual({
      subtotal: 2000,
      discount: 200,
      taxable: 1800,
      cgst: 162,
      sgst: 162,
      igst: 0,
      tax: 324,
      total: 2124,
    });
  });
  it('charges only IGST on interstate supplies', () => {
    expect(totals([line], true)).toMatchObject({ cgst: 0, sgst: 0, igst: 324, total: 2124 });
  });
  it('rounds each tax component to paise', () => {
    expect(totals([{ ...line, qty: 1, price: 99.99, discount: 0, gst: 5 }], false)).toMatchObject({
      cgst: 2.5,
      sgst: 2.5,
      total: 104.99,
    });
  });
  it('handles multiple GST rates independently', () => {
    expect(
      totals(
        [
          { ...line, qty: 1, price: 100, discount: 0, gst: 5 },
          { ...line, qty: 1, price: 100, discount: 0, gst: 18 },
        ],
        true,
      ).total,
    ).toBe(223);
  });
  it('assigns financial years at the April boundary', () => {
    expect(fy('2026-03-31')).toBe('25-26');
    expect(fy('2026-04-01')).toBe('26-27');
  });
  it('checks GSTIN format, state and checksum', () => {
    const valid = gst('08ABCDE1234F1Z');
    expect(validGstin(valid)).toBe(true);
    expect(validGstin(valid.slice(0, 14) + (valid[14] === '0' ? '1' : '0'))).toBe(false);
    expect(validGstin('99ABCDE1234F1Z0')).toBe(false);
  });
});
describe('invoice lifecycle and stock integrity', () => {
  it('saves a draft without consuming stock or a number', () => {
    const { state, invoice } = fixture();
    const next = applyCommand(state, { type: 'saveInvoice', invoice, issue: false });
    expect(next.products[0].stock).toBe(10);
    expect(next.counters).toEqual({});
    expect(next.invoices[0].status).toBe('draft');
  });
  it('issues with a unique sequence and deducts stock once', () => {
    const { state, invoice } = fixture();
    const next = applyCommand(state, { type: 'saveInvoice', invoice, issue: true });
    expect(next.products[0].stock).toBe(8);
    expect(next.invoices[0].number).toBe(`AE/${fy(today())}/0001`);
    expect(() => applyCommand(next, { type: 'saveInvoice', invoice, issue: true })).toThrow(
      'cannot be edited',
    );
    expect(state.products[0].stock).toBe(10);
  });
  it('increments invoice sequence for the next sale', () => {
    const { state, invoice } = fixture();
    const next = applyCommand(state, { type: 'saveInvoice', invoice, issue: true });
    const second = applyCommand(next, {
      type: 'saveInvoice',
      invoice: { ...invoice, id: 'i2' },
      issue: true,
    });
    expect(second.invoices[0].number).toBe(`AE/${fy(today())}/0002`);
  });
  it('rejects aggregated overselling across repeated lines without partial mutation', () => {
    const { state, invoice } = fixture();
    invoice.items = [
      { ...line, qty: 6 },
      { ...line, qty: 6 },
    ];
    expect(() => applyCommand(state, { type: 'saveInvoice', invoice, issue: true })).toThrow(
      'Insufficient stock',
    );
    expect(state.products[0].stock).toBe(10);
    expect(state.invoices).toHaveLength(0);
  });
  it('blocks issuance without supplier GSTIN', () => {
    const { state, invoice } = fixture();
    state.business.gstin = '';
    expect(() => applyCommand(state, { type: 'saveInvoice', invoice, issue: true })).toThrow(
      'valid GSTIN',
    );
  });
  it('preserves issued customer and business snapshots', () => {
    const { state, invoice } = fixture();
    let next = applyCommand(state, { type: 'saveInvoice', invoice, issue: true });
    next = applyCommand(next, {
      type: 'saveBusiness',
      business: { ...state.business, name: 'New name' },
    });
    next = applyCommand(next, {
      type: 'saveCustomer',
      customer: { ...state.customers[0], name: 'New customer name' },
    });
    expect(next.invoices[0].business.name).toBe('Agrawal Enterprises');
    expect(next.invoices[0].customer.name).toBe('Test Customer');
  });
  it('voids unpaid invoices, restores stock and retains the sequence', () => {
    const { state, invoice } = fixture();
    const issued = applyCommand(state, { type: 'saveInvoice', invoice, issue: true });
    const next = applyCommand(issued, { type: 'void', id: 'i1' });
    expect(next.products[0].stock).toBe(10);
    expect(balance(next.invoices[0])).toBe(0);
    expect(next.counters[fy(today())]).toBe(1);
    expect(() => applyCommand(next, { type: 'void', id: 'i1' })).toThrow();
  });
  it('rejects invalid quantities, discounts and non-finite prices', () => {
    for (const change of [{ qty: -1 }, { discount: 101 }, { price: NaN }]) {
      const { state, invoice } = fixture();
      invoice.items = [{ ...line, ...change }];
      expect(() => applyCommand(state, { type: 'saveInvoice', invoice, issue: false })).toThrow();
    }
  });
  it('prevents product edits from overwriting a stock balance', () => {
    const { state } = fixture();
    const next = applyCommand(state, {
      type: 'saveProduct',
      product: { ...state.products[0], stock: 900, name: 'Updated' },
    });
    expect(next.products[0].stock).toBe(10);
  });
  it('rejects stock adjustments that would make inventory negative', () => {
    const { state } = fixture();
    expect(() =>
      applyCommand(state, { type: 'stock', id: 'p1', quantity: -11, reason: 'Count correction' }),
    ).toThrow();
    const next = applyCommand(state, {
      type: 'stock',
      id: 'p1',
      quantity: 5,
      reason: 'Purchase received',
    });
    expect(next.products[0].stock).toBe(15);
    expect(next.audit[0].detail).toContain('Purchase received');
  });
  it('rejects duplicate SKUs', () => {
    const { state } = fixture();
    expect(() =>
      applyCommand(state, { type: 'saveProduct', product: { ...state.products[0], id: 'p2' } }),
    ).toThrow('SKU');
  });
  it('requires a matching state and GSTIN for B2B customers', () => {
    const { state } = fixture();
    expect(() =>
      applyCommand(state, {
        type: 'saveCustomer',
        customer: { ...state.customers[0], type: 'B2B', gstin: gst('08ABCDE1234F1Z'), state: '27' },
      }),
    ).toThrow('matching');
  });
  it('enforces the 16-character invoice-number limit', () => {
    const { state, invoice } = fixture();
    state.business.prefix = 'ABCDE';
    state.counters[fy(today())] = 9999;
    expect(() => applyCommand(state, { type: 'saveInvoice', invoice, issue: true })).toThrow(
      '16 characters',
    );
    expect(state.products[0].stock).toBe(10);
  });
});
describe('payments and exports', () => {
  function issued() {
    const { state, invoice } = fixture();
    return applyCommand(state, { type: 'saveInvoice', invoice, issue: true });
  }
  const payment = {
    id: 'pay1',
    invoiceId: 'i1',
    invoiceNumber: '',
    customerName: '',
    amount: 500,
    date: today(),
    method: 'UPI',
    reference: 'UTR1',
  };
  it('records partial and complete payments', () => {
    let state = issued();
    state = applyCommand(state, { type: 'payment', payment });
    expect(balance(state.invoices[0])).toBe(1624);
    expect(status(state.invoices[0])).toBe('Partially paid');
    state = applyCommand(state, {
      type: 'payment',
      payment: { ...payment, id: 'pay2', amount: 1624 },
    });
    expect(status(state.invoices[0])).toBe('Paid');
    expect(state.invoices[0].paid).toBe(invoiceTotals(state.invoices[0]).total);
  });
  it('rejects overpayment, zero-rounded values, duplicate receipts and voiding paid invoices', () => {
    let state = issued();
    expect(() =>
      applyCommand(state, { type: 'payment', payment: { ...payment, amount: 9999 } }),
    ).toThrow();
    expect(() =>
      applyCommand(state, { type: 'payment', payment: { ...payment, amount: 0.001 } }),
    ).toThrow();
    state = applyCommand(state, { type: 'payment', payment });
    expect(() => applyCommand(state, { type: 'payment', payment })).toThrow('already');
    expect(() => applyCommand(state, { type: 'void', id: 'i1' })).toThrow('credit-note');
  });
  it('rejects payments on drafts', () => {
    const { state, invoice } = fixture();
    const next = applyCommand(state, { type: 'saveInvoice', invoice, issue: false });
    expect(() => applyCommand(next, { type: 'payment', payment })).toThrow('issued invoices');
  });
  it('quotes CSV values and neutralizes spreadsheet formulas', () => {
    expect(csv([['=HYPERLINK("bad")', 'a,b', 'line\n2']])).toContain('"\'=HYPERLINK(""bad"")"');
    expect(csv([['a,b']])).toBe('\uFEFF"a,b"');
  });
});

describe('Historical purchase costing', () => {
  it('averages remaining stock and freezes issued profit across later purchases and edits', () => {
    let { state, invoice } = fixture();
    state = applyCommand(state, {
      type: 'purchase',
      purchase: {
        id: 'buy1',
        productId: 'p1',
        quantity: 10,
        unitCost: 700,
        date: today(),
        reference: 'Supplier bill 1',
      },
    });
    expect(state.products[0].cost).toBe(600);
    expect(state.products[0].stock).toBe(20);
    invoice.items[0].costTotal = 1; // Client cost is never authoritative.
    state = applyCommand(state, { type: 'saveInvoice', invoice, issue: true });
    expect(invoiceProfit(state.invoices[0])).toEqual({ sales: 1800, cost: 1200, profit: 600 });
    state = applyCommand(state, {
      type: 'purchase',
      purchase: {
        id: 'buy2',
        productId: 'p1',
        quantity: 2,
        unitCost: 800,
        date: today(),
        reference: 'Supplier bill 2',
      },
    });
    expect(state.products[0].cost).toBe(620);
    expect(invoiceProfit(state.invoices[0])?.profit).toBe(600);
    state = applyCommand(state, {
      type: 'saveProduct',
      product: { ...state.products[0], cost: 1 },
    });
    expect(state.products[0].cost).toBe(620);
    state = applyCommand(state, { type: 'void', id: invoice.id });
    expect(state.products[0].stock).toBe(22);
    expect(state.products[0].cost).toBeCloseTo((20 * 620 + 1200) / 22, 6);
    expect(invoiceProfit(state.invoices[0])).toBeNull();
  });
  it('does not invent historical costs or allow duplicate/invalid purchases', () => {
    const { state, invoice } = fixture();
    expect(invoiceProfit({ ...invoice, status: 'issued' })).toBeNull();
    const purchase = {
      id: 'buy1',
      productId: 'p1',
      quantity: 1,
      unitCost: 0,
      date: today(),
      reference: 'Free stock',
    };
    const next = applyCommand(state, { type: 'purchase', purchase });
    expect(next.purchases).toHaveLength(1);
    expect(() => applyCommand(next, { type: 'purchase', purchase })).toThrow('already');
    expect(() =>
      applyCommand(state, { type: 'purchase', purchase: { ...purchase, quantity: -1 } }),
    ).toThrow();
  });
});

describe('Draft deletion', () => {
  it('removes only the requested draft without changing stock, counters or issued sales', () => {
    const { state, invoice } = fixture();
    state.invoices = [
      invoice,
      { ...invoice, id: 'issued', status: 'issued', number: 'AE/26-27/0001' },
    ];
    const next = applyCommand(state, { type: 'deleteDraft', id: invoice.id });
    expect(next.invoices.map((i) => i.id)).toEqual(['issued']);
    expect(next.products).toEqual(state.products);
    expect(next.counters).toEqual(state.counters);
    expect(next.audit[0].action).toBe('Draft deleted');
    expect(state.invoices).toHaveLength(2);
    expect(() => applyCommand(next, { type: 'deleteDraft', id: 'issued' })).toThrow(
      'Only an unpaid draft',
    );
  });
});
