import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { buildGstr1Report, sectionFor } from './gstr1';
import type { Gstr1Options } from './gstr1';
import { createGstr1Workbook } from './gstr1Excel';
import { defaultBusiness, emptyWorkspace } from './seed';
import type { Invoice, Workspace } from '../types';
import { invoiceTotals, round } from './billing';

const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const prefix = '08ABCDE1234F1Z';
let checksum = 0;
for (let n = 0; n < 14; n++) {
  const v = chars.indexOf(prefix[n]) * (n % 2 === 0 ? 1 : 2);
  checksum += Math.floor(v / 36) + (v % 36);
}
const supplierGstin = prefix + chars[(36 - (checksum % 36)) % 36];
const business = { ...defaultBusiness, gstin: supplierGstin };
const options: Gstr1Options = {
  from: '2026-10-01',
  to: '2026-10-31',
  gstin: supplierGstin,
  hsnDigits: 4,
  demo: false,
};
function invoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: 'i1',
    number: 'AE/26-27/0001',
    business: { ...business },
    customer: {
      id: 'c1',
      name: 'Test customer',
      type: 'B2C',
      gstin: '',
      state: '08',
      address: 'Jaipur',
      email: '',
      phone: '',
    },
    date: '2026-10-01',
    dueDate: '2026-10-31',
    placeOfSupply: '08',
    shippingAddress: '',
    reference: '',
    items: [
      {
        productId: 'p1',
        name: 'Goods',
        hsn: '420222',
        unit: 'PCS',
        qty: 1,
        price: 100,
        discount: 0,
        gst: 18,
      },
    ],
    notes: '',
    status: 'issued',
    paid: 0,
    createdAt: '2026-10-01T00:00:00Z',
    ...overrides,
  };
}
function state(invoices: Invoice[]): Workspace {
  return { ...emptyWorkspace(), business: { ...business }, invoices };
}
function tab(report: ReturnType<typeof buildGstr1Report>, name: string) {
  return report.sheets.find((s) => s.name === name)!;
}
describe('GSTR-1 preparation schedules', () => {
  it('uses the full invoice value and the date-specific strict B2CL limit', () => {
    const i = invoice({ placeOfSupply: '07' });
    i.items[0].gst = 0;
    i.items[0].price = 100000;
    expect(sectionFor(i)).toBe('B2CS');
    i.items[0].price = 100000.01;
    expect(sectionFor(i)).toBe('B2CL');
    i.date = '2024-07-31';
    expect(sectionFor(i)).toBe('B2CS');
    i.items[0].price = 250000;
    expect(sectionFor(i)).toBe('B2CS');
    i.items[0].price = 250000.01;
    expect(sectionFor(i)).toBe('B2CL');
    i.placeOfSupply = '08';
    expect(sectionFor(i)).toBe('B2CS');
    i.customer.type = 'B2B';
    expect(sectionFor(i)).toBe('B2B');
    i.customer.type = 'B2C';
    i.placeOfSupply = '07';
    i.date = '2026-10-01';
    i.items[0].price = 90000;
    i.items[0].gst = 18;
    expect(sectionFor(i)).toBe('B2CL');
  });
  it('groups B2B per invoice and rate without repeating taxable sales', () => {
    const i = invoice();
    i.customer = { ...i.customer, type: 'B2B', gstin: supplierGstin };
    i.items.push(
      { ...i.items[0], qty: 2, price: 99.99, discount: 3.33, gst: 5 },
      { ...i.items[0], price: 10 },
    );
    const report = buildGstr1Report(state([i]), options),
      rows = tab(report, 'B2B').rows;
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r[9])).toEqual([5, 18]);
    expect(rows.every((r) => r[5] === invoiceTotals(i).total)).toBe(true);
    expect(round(rows.reduce((s, r) => s + Number(r[10]), 0))).toBe(invoiceTotals(i).taxable);
    expect(report.actual.total).toBe(invoiceTotals(i).total);
    expect(tab(report, 'Reconciliation').rows.every((r) => r[3] === 0 && r[5] === 0)).toBe(true);
  });
  it('keeps B2CS month, place, supply type and rate groups separate', () => {
    const a = invoice(),
      b = invoice({ id: 'i2', number: 'AE/26-27/0002' }),
      c = invoice({ id: 'i3', number: 'AE/26-27/0003', placeOfSupply: '07' }),
      d = invoice({ id: 'i4', number: 'AE/26-27/0004', date: '2026-11-01' });
    const report = buildGstr1Report(state([a, b, c, d]), { ...options, to: '2026-11-30' });
    const rows = tab(report, 'B2CS').rows;
    expect(rows).toHaveLength(3);
    expect(rows.find((r) => r[0] === '2026-10' && r[1] === 'Intra-State')?.[4]).toBe(200);
    expect(rows.find((r) => r[1] === 'Inter-State')?.[7]).toBe(18);
  });
  it('splits HSN by recipient type, unit and rate and preserves line tax rounding', () => {
    const a = invoice();
    a.items = [
      { ...a.items[0], price: 0.1, qty: 1, gst: 5 },
      { ...a.items[0], price: 0.1, qty: 1, gst: 5 },
      { ...a.items[0], unit: 'BOX', gst: 5 },
    ];
    const b = invoice({ id: 'i2', number: 'AE/26-27/0002', placeOfSupply: '07' });
    b.customer = { ...b.customer, type: 'B2B', gstin: supplierGstin };
    const report = buildGstr1Report(state([a, b]), options);
    const hsn = tab(report, 'HSN B2C').rows;
    expect(hsn).toHaveLength(2);
    expect(hsn.find((r) => r[3] === 'PCS')?.[7]).toBe(0.2);
    expect(hsn.find((r) => r[3] === 'PCS')?.[8]).toBe(0);
    expect(tab(report, 'HSN B2B').rows).toHaveLength(1);
    expect(tab(report, 'Reconciliation').rows.every((r) => r[3] === 0 && r[5] === 0)).toBe(true);
  });
  it('does not guess the table 8 classification from zero percent', () => {
    const i = invoice();
    i.items.push({ ...i.items[0], price: 50, gst: 0 });
    const report = buildGstr1Report(state([i]), options);
    expect(report.sectionTotals.B2CS.taxable).toBe(100);
    expect(report.sectionTotals['Zero rate review'].taxable).toBe(50);
    expect(tab(report, 'Zero rate review').rows).toHaveLength(1);
    expect(tab(report, 'Review').rows.some((r) => String(r[1]).includes('0%'))).toBe(true);
    expect(tab(report, 'Reconciliation').rows.every((r) => r[3] === 0 && r[5] === 0)).toBe(true);
  });
  it('excludes drafts and void sales but reports actual cancellation and serial gaps', () => {
    const report = buildGstr1Report(
      state([
        invoice(),
        invoice({ id: 'i2', number: 'AE/26-27/0002', status: 'void' }),
        invoice({ id: 'i3', number: 'AE/26-27/0004' }),
        invoice({ id: 'draft', number: 'DRAFT', status: 'draft' }),
      ]),
      options,
    );
    expect(report.issued).toHaveLength(2);
    expect(report.actual.taxable).toBe(200);
    expect(tab(report, 'Documents issued').rows.map((r) => r.slice(4))).toEqual([
      [2, 1, 1],
      [1, 0, 1],
    ]);
    expect(tab(report, 'Review').rows.some((r) => String(r[1]).includes('Non-contiguous'))).toBe(
      true,
    );
    expect(tab(report, 'Invoice items').rows).toHaveLength(2);
  });
  it('isolates supplier GSTINs and catches duplicate numbers, invalid recipients and HSNs', () => {
    const a = invoice();
    a.customer.type = 'B2B';
    a.items[0].hsn = '1234';
    a.items[0].unit = 'CUSTOM';
    const b = invoice({ id: 'i2' }),
      c = invoice({ id: 'i3', business: { ...defaultBusiness, gstin: 'other' } });
    const report = buildGstr1Report(state([a, b, c]), { ...options, hsnDigits: 6 });
    expect(report.documents).toHaveLength(2);
    expect(report.actual.taxable).toBe(200);
    const issues = JSON.stringify(tab(report, 'Review').rows);
    expect(issues).toContain('Duplicate');
    expect(issues).toContain('Invalid recipient');
    expect(issues).toContain('HSN-SAC');
    expect(issues).toContain('Unmapped');
    expect(issues).toContain('Excluded');
  });
  it('validates date and GSTIN, and makes demo, empty or partial-period limits visible', () => {
    expect(() => buildGstr1Report(state([]), { ...options, from: '2026-02-30' })).toThrow();
    expect(() => buildGstr1Report(state([]), { ...options, gstin: 'bad' })).toThrow();
    const report = buildGstr1Report(state([]), {
      ...options,
      from: '2026-10-02',
      demo: true,
      hsnDigits: null,
    });
    const issues = JSON.stringify(tab(report, 'Review').rows);
    expect(issues).toContain('DEMO DATA');
    expect(issues).toContain('No numbered');
    expect(issues).toContain('Partial month');
    expect(issues).toContain('not confirmed');
  });
  it('writes a real XLSX with typed dates, identifiers, cached formulas, panes and literal user text', async () => {
    const i = invoice();
    i.customer.name = '=HYPERLINK("https://example.invalid")';
    i.items[0].hsn = '001234';
    const wb = createGstr1Workbook(state([i]), options);
    expect(wb.worksheets).toHaveLength(13);
    expect(wb.getWorksheet('Summary')!.getCell('B9').value).toEqual({
      formula: "SUM('B2CS'!E7:E7)",
      result: 100,
    });
    const saved = await wb.xlsx.writeBuffer(),
      loaded = new ExcelJS.Workbook();
    await loaded.xlsx.load(saved);
    const register = loaded.getWorksheet('Sales register')!;
    expect(register.getCell('C7').value).toBeInstanceOf(Date);
    expect(register.getCell('E7').value).toBe(i.customer.name);
    expect(loaded.getWorksheet('Invoice items')!.getCell('I7').value).toBe('001234');
    expect(register.views[0]).toMatchObject({
      state: 'frozen',
      ySplit: 6,
      xSplit: 1,
      showGridLines: false,
    });
    expect(loaded.getWorksheet('Summary')!.getCell('B11').value).toEqual({
      formula: 'SUM(B7:B10)',
      result: 100,
    });
    expect(loaded.getWorksheet('Reconciliation')!.getCell('D7').formula).toBe('ROUND(B7-C7,2)');
    const zip = await JSZip.loadAsync(saved);
    const xml = await zip.file('xl/worksheets/sheet11.xml')!.async('string');
    expect(xml).toMatch(/<c r="D7"[^>]*><f>ROUND\(B7-C7,2\)<\/f><v>0<\/v><\/c>/);
    expect(saved.byteLength).toBeGreaterThan(10000);
  });
});
