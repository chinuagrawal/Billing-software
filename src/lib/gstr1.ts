import type { Invoice, Workspace } from '../types';
import { invoiceTotals, round, STATES, totals, validGstin } from './billing';

// GST Portal: GSTR-1 user guide and Returns Offline Tool manual. See Filing notes in export.
export const GST_GUIDE =
  'https://tutorial.gst.gov.in/userguide/returns/Creation_of_Outward_Supplies_Return_in_GSTR-1.htm';
export const GST_OFFLINE_GUIDE =
  'https://tutorial.gst.gov.in/downloads/invoiceuploadofflineutility.pdf';
export type ReportCell = string | number | Date;
export interface ReportSheet {
  name: string;
  headers: string[];
  rows: ReportCell[][];
  moneyColumns?: number[]; // one based
  dateColumns?: number[];
}
export interface Gstr1Options {
  from: string;
  to: string;
  gstin: string;
  hsnDigits: 4 | 6 | null;
  demo: boolean;
}
export type GstrSection = 'B2B' | 'B2CL' | 'B2CS' | 'Zero rate review';
type Amounts = { taxable: number; cgst: number; sgst: number; igst: number; total: number };
const zero = (): Amounts => ({ taxable: 0, cgst: 0, sgst: 0, igst: 0, total: 0 });
const amountKeys = ['taxable', 'cgst', 'sgst', 'igst', 'total'] as const;
function add(target: Amounts, values: Amounts) {
  for (const key of amountKeys) target[key] = round(target[key] + values[key]);
}
const values = (a: Amounts) => amountKeys.map((k) => a[k]);
const excelDate = (s: string) => new Date(`${s}T00:00:00Z`);
const pos = (code: string) => `${code}-${STATES[code] || 'Unknown'}`;
export const b2clLimit = (date: string) => (date >= '2024-08-01' ? 100000 : 250000);
export function sectionFor(i: Invoice): Exclude<GstrSection, 'Zero rate review'> {
  if (i.customer.type === 'B2B') return 'B2B';
  return i.business.state !== i.placeOfSupply && invoiceTotals(i).total > b2clLimit(i.date)
    ? 'B2CL'
    : 'B2CS';
}
const uqcMap: Record<string, string> = {
  PCS: 'PCS',
  NOS: 'NOS',
  KGS: 'KGS',
  MTR: 'MTR',
  LTR: 'LTR',
  BOX: 'BOX',
  SET: 'SET',
};
const dateValid = (s: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(s) &&
  !Number.isNaN(excelDate(s).getTime()) &&
  excelDate(s).toISOString().slice(0, 10) === s;

export function buildGstr1Report(data: Workspace, options: Gstr1Options) {
  const { from, to, gstin, hsnDigits, demo } = options;
  if (!dateValid(from) || !dateValid(to) || from > to)
    throw new Error('Choose a valid report date range.');
  if (!validGstin(gstin) && !(demo && gstin === ''))
    throw new Error('Choose a valid supplier GSTIN before exporting.');
  const review: ReportCell[][] = [];
  const warn = (invoice: string, issue: string, action: string) =>
    review.push([invoice, issue, action]);
  const inRange = data.invoices.filter(
    (i) => i.date >= from && i.date <= to && i.status !== 'draft',
  );
  const documents = inRange
    .filter((i) => i.business.gstin === gstin)
    .sort((a, b) => a.date.localeCompare(b.date) || a.number.localeCompare(b.number));
  const issued = documents.filter((i) => i.status === 'issued');
  if (demo)
    warn('Report', 'DEMO DATA', 'Sample records only. Do not use this workbook to file a return.');
  if (!hsnDigits)
    warn(
      'Report',
      'HSN length not confirmed',
      'Confirm preceding financial year aggregate turnover, then select 4 or 6 minimum digits.',
    );
  if (!documents.length)
    warn(
      'Report',
      'No numbered invoices in this range',
      'Check date range and GSTIN. This alone does not confirm a nil return.',
    );
  const lastDay = new Date(
    Date.UTC(Number(to.slice(0, 4)), Number(to.slice(5, 7)), 0),
  ).getUTCDate();
  if (!from.endsWith('-01') || Number(to.slice(8)) !== lastDay)
    warn(
      'Report',
      'Partial month selected',
      'Use complete tax months or the full filing quarter before preparing a return.',
    );
  if (from.slice(0, 7) !== to.slice(0, 7))
    warn(
      'Report',
      'Multiple tax months selected',
      'Period columns keep monthly totals separate. Confirm monthly versus quarterly filing.',
    );
  for (const i of inRange.filter((i) => i.business.gstin !== gstin))
    warn(
      i.number,
      `Excluded: supplier GSTIN ${i.business.gstin || 'missing'}`,
      'Export this GSTIN separately; this invoice is not in the selected taxpayer totals.',
    );

  const b2b: ReportSheet = {
    name: 'B2B',
    headers: [
      'Period',
      'Recipient GSTIN',
      'Recipient name',
      'Invoice number',
      'Invoice date',
      'Invoice value INR',
      'Place of supply',
      'Reverse charge',
      'Invoice type',
      'GST rate %',
      'Taxable value INR',
      'CGST INR',
      'SGST-UTGST INR',
      'IGST INR',
      'Cess INR',
    ],
    rows: [],
    moneyColumns: [6, 11, 12, 13, 14, 15],
    dateColumns: [5],
  };
  const b2cl: ReportSheet = {
    name: 'B2CL',
    headers: [
      'Period',
      'Invoice number',
      'Invoice date',
      'Invoice value INR',
      'Place of supply',
      'GST rate %',
      'Taxable value INR',
      'CGST INR',
      'SGST-UTGST INR',
      'IGST INR',
      'Cess INR',
    ],
    rows: [],
    moneyColumns: [4, 7, 8, 9, 10, 11],
    dateColumns: [3],
  };
  const b2cs: ReportSheet = {
    name: 'B2CS',
    headers: [
      'Period',
      'Supply type',
      'Place of supply',
      'GST rate %',
      'Taxable value INR',
      'CGST INR',
      'SGST-UTGST INR',
      'IGST INR',
      'Cess INR',
    ],
    rows: [],
    moneyColumns: [5, 6, 7, 8, 9],
  };
  const hsnHeaders = [
    'Period',
    'HSN-SAC',
    'Description (first recorded)',
    'UQC',
    'Quantity',
    'GST rate %',
    'Total value INR',
    'Taxable value INR',
    'CGST INR',
    'SGST-UTGST INR',
    'IGST INR',
    'Cess INR',
  ];
  const hsnB2b: ReportSheet = {
    name: 'HSN B2B',
    headers: hsnHeaders,
    rows: [],
    moneyColumns: [7, 8, 9, 10, 11, 12],
  };
  const hsnB2c: ReportSheet = { ...hsnB2b, name: 'HSN B2C', rows: [] };
  const lines: ReportSheet = {
    name: 'Invoice items',
    headers: [
      'Period',
      'Invoice number',
      'Invoice date',
      'Section',
      'Recipient name',
      'Recipient GSTIN',
      'Place of supply',
      'Item',
      'HSN-SAC',
      'UQC',
      'Quantity',
      'Unit price INR',
      'Discount %',
      'GST rate %',
      'Taxable value INR',
      'CGST INR',
      'SGST-UTGST INR',
      'IGST INR',
      'Line total INR',
    ],
    rows: [],
    moneyColumns: [12, 15, 16, 17, 18, 19],
    dateColumns: [3],
  };
  const zeroRates: ReportSheet = {
    name: 'Zero rate review',
    headers: [
      'Period',
      'Invoice',
      'Recipient type',
      'Place of supply',
      'HSN-SAC',
      'Description',
      'Value INR',
      'Action',
    ],
    rows: [],
    moneyColumns: [7],
  };
  const register: ReportSheet = {
    name: 'Sales register',
    headers: [
      'Period',
      'Invoice number',
      'Invoice date',
      'Status',
      'Recipient name',
      'Recipient type',
      'Recipient GSTIN',
      'Place of supply',
      'Section',
      'Taxable value INR',
      'CGST INR',
      'SGST-UTGST INR',
      'IGST INR',
      'Invoice value INR',
    ],
    rows: [],
    moneyColumns: [10, 11, 12, 13, 14],
    dateColumns: [3],
  };
  const sectionTotals: Record<GstrSection, Amounts> = {
    B2B: zero(),
    B2CL: zero(),
    B2CS: zero(),
    'Zero rate review': zero(),
  };
  const smallGroups = new Map<
    string,
    { period: string; supply: string; place: string; rate: number; amounts: Amounts }
  >();
  const hsnGroups = new Map<
    string,
    {
      type: string;
      period: string;
      hsn: string;
      name: string;
      uqc: string;
      qty: number;
      rate: number;
      amounts: Amounts;
    }
  >();
  const seen = new Set<string>();
  for (const i of documents) {
    const period = i.date.slice(0, 7),
      t = invoiceTotals(i),
      section = sectionFor(i);
    register.rows.push([
      period,
      i.number,
      excelDate(i.date),
      i.status,
      i.customer.name,
      i.customer.type,
      i.customer.gstin,
      pos(i.placeOfSupply),
      section,
      ...values(t),
    ]);
    if (seen.has(i.number))
      warn(i.number, 'Duplicate invoice number', 'Resolve duplicate numbers before filing.');
    seen.add(i.number);
    if (!/^[A-Za-z0-9/-]{1,16}$/.test(i.number))
      warn(
        i.number,
        'Invalid invoice number format',
        'Review the recorded number against GST invoice requirements.',
      );
    if (i.business.gstin.slice(0, 2) !== i.business.state || !STATES[i.placeOfSupply])
      warn(
        i.number,
        'Supplier state or place of supply needs review',
        'Confirm the tax split against the issued document.',
      );
    if (
      i.customer.type === 'B2B' &&
      (!validGstin(i.customer.gstin) || i.customer.gstin.slice(0, 2) !== i.customer.state)
    )
      warn(
        i.number,
        'Invalid recipient GSTIN or state',
        'Verify the recipient registration and correct through the applicable amendment process.',
      );
    if (i.customer.type === 'B2C' && i.customer.gstin)
      warn(i.number, 'B2C recipient has a GSTIN', 'Confirm B2B versus B2C classification.');
    if (i.status === 'void') continue;
    const rates = new Map<number, Amounts>();
    for (const item of i.items) {
      const a = totals([item], i.business.state !== i.placeOfSupply),
        uqc = uqcMap[item.unit.toUpperCase()] || 'OTH';
      const lineSection: GstrSection = item.gst === 0 ? 'Zero rate review' : section;
      lines.rows.push([
        period,
        i.number,
        excelDate(i.date),
        lineSection,
        i.customer.name,
        i.customer.gstin,
        pos(i.placeOfSupply),
        item.name,
        item.hsn,
        uqc,
        item.qty,
        item.price,
        item.discount,
        item.gst,
        a.taxable,
        a.cgst,
        a.sgst,
        a.igst,
        a.total,
      ]);
      add(sectionTotals[lineSection], a);
      if (item.gst === 0) {
        zeroRates.rows.push([
          period,
          i.number,
          i.customer.type,
          pos(i.placeOfSupply),
          item.hsn,
          item.name,
          a.taxable,
          'Classify as nil-rated, exempt, non-GST or other applicable supply; table 8 is not inferred from a 0% rate.',
        ]);
        warn(
          i.number,
          `0% line: ${item.name}`,
          'Classify this supply; it is excluded from B2B/B2CL/B2CS taxable schedules pending review. HSN includes it for reconciliation.',
        );
      } else {
        const group = rates.get(item.gst) || zero();
        add(group, a);
        rates.set(item.gst, group);
      }
      if (!/^\d{4,8}$/.test(item.hsn) || (hsnDigits && item.hsn.length < hsnDigits))
        warn(
          i.number,
          `HSN-SAC ${item.hsn} needs review`,
          `Confirm a valid code${hsnDigits ? ` with at least ${hsnDigits} digits` : ' and required digit length'}.`,
        );
      if (!uqcMap[item.unit.toUpperCase()])
        warn(
          i.number,
          `Unmapped unit ${item.unit}`,
          'UQC exported as OTH. Confirm the correct portal unit, particularly for services.',
        );
      const key = JSON.stringify([i.customer.type, period, item.hsn, uqc, item.gst]);
      const h = hsnGroups.get(key) || {
        type: i.customer.type,
        period,
        hsn: item.hsn,
        name: item.name,
        uqc,
        qty: 0,
        rate: item.gst,
        amounts: zero(),
      };
      h.qty = Math.round((h.qty + item.qty) * 1000000) / 1000000;
      add(h.amounts, a);
      hsnGroups.set(key, h);
    }
    for (const [rate, a] of [...rates].sort(([a], [b]) => a - b)) {
      if (section === 'B2B')
        b2b.rows.push([
          period,
          i.customer.gstin,
          i.customer.name,
          i.number,
          excelDate(i.date),
          t.total,
          pos(i.placeOfSupply),
          'N',
          'Regular',
          rate,
          a.taxable,
          a.cgst,
          a.sgst,
          a.igst,
          0,
        ]);
      else if (section === 'B2CL')
        b2cl.rows.push([
          period,
          i.number,
          excelDate(i.date),
          t.total,
          pos(i.placeOfSupply),
          rate,
          a.taxable,
          a.cgst,
          a.sgst,
          a.igst,
          0,
        ]);
      else {
        const supply = i.business.state !== i.placeOfSupply ? 'Inter-State' : 'Intra-State';
        const key = JSON.stringify([period, supply, i.placeOfSupply, rate]);
        const g = smallGroups.get(key) || {
          period,
          supply,
          place: i.placeOfSupply,
          rate,
          amounts: zero(),
        };
        add(g.amounts, a);
        smallGroups.set(key, g);
      }
    }
  }
  for (const g of smallGroups.values())
    b2cs.rows.push([
      g.period,
      g.supply,
      pos(g.place),
      g.rate,
      g.amounts.taxable,
      g.amounts.cgst,
      g.amounts.sgst,
      g.amounts.igst,
      0,
    ]);
  for (const h of hsnGroups.values())
    (h.type === 'B2B' ? hsnB2b : hsnB2c).rows.push([
      h.period,
      h.hsn,
      h.name,
      h.uqc,
      h.qty,
      h.rate,
      h.amounts.total,
      h.amounts.taxable,
      h.amounts.cgst,
      h.amounts.sgst,
      h.amounts.igst,
      0,
    ]);

  // Only contiguous, actually recorded serials are combined. Gaps are never invented as cancellations.
  const docs: ReportSheet = {
    name: 'Documents issued',
    headers: [
      'Period',
      'Nature of document',
      'From number',
      'To number',
      'Total documents',
      'Cancelled (current status)',
      'Net issued',
    ],
    rows: [],
  };
  const series = new Map<
    string,
    { period: string; prefix: string; docs: { number: string; seq: number; cancelled: number }[] }
  >();
  for (const i of documents) {
    const match = /^(.*\/)(\d+)$/.exec(i.number),
      period = i.date.slice(0, 7);
    if (!match) {
      docs.rows.push([
        period,
        'Invoices for outward supply',
        i.number,
        i.number,
        1,
        i.status === 'void' ? 1 : 0,
        i.status === 'void' ? 0 : 1,
      ]);
      continue;
    }
    const key = JSON.stringify([period, match[1]]),
      g = series.get(key) || { period, prefix: match[1], docs: [] };
    g.docs.push({
      number: i.number,
      seq: Number(match[2]),
      cancelled: i.status === 'void' ? 1 : 0,
    });
    series.set(key, g);
  }
  for (const g of series.values()) {
    g.docs.sort((a, b) => a.seq - b.seq);
    let run: typeof g.docs = [];
    const flush = () => {
      if (run.length) {
        const cancelled = run.reduce((n, d) => n + d.cancelled, 0);
        docs.rows.push([
          g.period,
          'Invoices for outward supply',
          run[0].number,
          run[run.length - 1].number,
          run.length,
          cancelled,
          run.length - cancelled,
        ]);
      }
      run = [];
    };
    for (const d of g.docs) {
      if (run.length && d.seq !== run[run.length - 1].seq + 1) {
        warn(
          d.number,
          `Non-contiguous document series ${g.prefix}`,
          'Check missing or duplicate serials; gaps are not counted as cancelled invoices.',
        );
        flush();
      }
      run.push(d);
    }
    flush();
  }
  const actual = issued.reduce((s, i) => {
    add(s, invoiceTotals(i));
    return s;
  }, zero());
  const summary: ReportSheet = {
    name: 'Summary',
    headers: [
      'Section',
      'Taxable value INR',
      'CGST INR',
      'SGST-UTGST INR',
      'IGST INR',
      'Value incl. tax INR',
    ],
    rows: Object.entries(sectionTotals).map(([label, a]) => [label, ...values(a)]),
    moneyColumns: [2, 3, 4, 5, 6],
  };
  const reconciliation: ReportSheet = {
    name: 'Reconciliation',
    headers: [
      'Measure',
      'Issued sales register INR',
      'Schedules plus zero-rate review INR',
      'Difference INR',
      'HSN B2B plus B2C INR',
      'HSN difference INR',
    ],
    rows: amountKeys.map((key) => [
      key,
      actual[key],
      round(Object.values(sectionTotals).reduce((s, a) => s + a[key], 0)),
      0,
      round([...hsnGroups.values()].reduce((s, h) => s + h.amounts[key], 0)),
      0,
    ]),
    moneyColumns: [2, 3, 4, 5, 6],
  };
  // Differences calculated independently of presentation formulas for tests and cached values.
  for (const r of reconciliation.rows) {
    r[3] = round(Number(r[1]) - Number(r[2]));
    r[5] = round(Number(r[1]) - Number(r[4]));
  }
  const reviewSheet: ReportSheet = {
    name: 'Review',
    headers: ['Invoice or scope', 'Issue', 'Action required'],
    rows: [...new Map(review.map((r) => [JSON.stringify(r), r])).values()],
  };
  const notes: ReportSheet = {
    name: 'Filing notes',
    headers: ['Topic', 'Scope and action'],
    rows: [
      [
        'Purpose',
        'GSTR-1 preparation workbook for accountant review. This is not the GST Portal offline-import template, upload JSON, or a filed return. Transfer reviewed values into the current utility or portal.',
      ],
      [
        'Source',
        'Issued invoice snapshots in this app for the selected GSTIN and invoice-date range. Drafts excluded; current void status is reflected. Payments and purchase costs do not determine outward tax.',
      ],
      [
        'B2B',
        'Regular domestic taxable supplies only. Reverse charge N and cess 0 reflect app limitations; confirm that these assumptions apply. Invoice value repeats for each rate: do not sum that column.',
      ],
      [
        'B2CL',
        'Interstate unregistered supplies with full invoice value above INR 100,000 from August 2024, or above INR 250,000 earlier. Boundary invoices and all intrastate B2C go to B2CS.',
      ],
      [
        'HSN table 12',
        'B2B and B2C summaries are separate. Grouped by month, HSN-SAC, UQC and GST rate; different units are not summed together. Confirm HSN codes and service UQC. Zero-rate lines remain visible here but require classification.',
      ],
      [
        'Document table 13',
        'Only invoice series stored in the app. Current voids count as cancelled; cancellation dates and filing history are not recorded. Verify cancellations for this tax period, missing serials and documents issued outside this app.',
      ],
      [
        'Table 8',
        '0% alone cannot distinguish nil-rated, exempt, non-GST or zero-rated supplies. Use Zero rate review to classify; no table 8 totals are assumed.',
      ],
      [
        'Credit-debit notes, amendments',
        'Not recorded. Confirm CDNR, CDNUR, B2BA, B2CLA, B2CSA, CDNRA and CDNURA separately; absence here is not confirmation of nil activity.',
      ],
      [
        'Exports, SEZ, deemed exports',
        'Not supported by the invoice model. Confirm tables 6A, 6B and 6C, shipping/export details and related amendments separately.',
      ],
      [
        'Advances and adjustments',
        'Not classified in the app. Review tables 11A and 11B and amendments separately if applicable.',
      ],
      [
        'Other supplies',
        'Cess, reverse charge, differential tax, ECO tables 14/15 and amendments are not supported. Confirm applicability outside this workbook.',
      ],
      [
        'Filing checks',
        'Reconcile against the GST Portal, e-invoice data and other accounting records; resolve Review rows; confirm full month/quarter and turnover-based HSN requirements before filing.',
      ],
      [
        'Editing',
        'Export is a snapshot. Summary and reconciliation formulas update numeric totals, but editing an invoice row does not rebuild classifications or grouped schedules. Correct source records and re-export.',
      ],
      [
        'GSTR-3B and ITC',
        'This outward-supplies workbook does not calculate input tax credit, GSTR-2B reconciliation, GSTR-3B net liability or purchase GST.',
      ],
      ['GST Portal GSTR-1 guide', GST_GUIDE],
      ['GST Portal offline tool manual', GST_OFFLINE_GUIDE],
    ],
  };
  return {
    options,
    documents,
    issued,
    actual,
    sectionTotals,
    sheets: [
      summary,
      b2b,
      b2cl,
      b2cs,
      hsnB2b,
      hsnB2c,
      docs,
      register,
      lines,
      zeroRates,
      reconciliation,
      reviewSheet,
      notes,
    ],
  };
}
