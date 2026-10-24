import type { Invoice, InvoiceTemplate } from '../types';
import { round, totals } from './billing';

export const INVOICE_TEMPLATES: { id: InvoiceTemplate; name: string; description: string }[] = [
  {
    id: 'classic',
    name: 'Classic GST',
    description: 'A bordered tax invoice with an HSN tax summary and amount in words.',
  },
  {
    id: 'modern',
    name: 'Modern',
    description: 'A refined green layout with clear sections and a prominent total.',
  },
  {
    id: 'minimal',
    name: 'Minimal',
    description: 'A clean, monochrome invoice with light rules and compact details.',
  },
];
export function resolveTemplate(value?: string): InvoiceTemplate {
  return INVOICE_TEMPLATES.find((t) => t.id === value)?.id || 'modern';
}

export function taxSummary(invoice: Invoice) {
  const rows = new Map<
    string,
    {
      hsn: string;
      rate: number;
      taxable: number;
      cgst: number;
      sgst: number;
      igst: number;
      tax: number;
    }
  >();
  for (const item of invoice.items) {
    const key = `${item.hsn}:${item.gst}`;
    const values = totals([item], invoice.business.state !== invoice.placeOfSupply);
    const row = rows.get(key) || {
      hsn: item.hsn,
      rate: item.gst,
      taxable: 0,
      cgst: 0,
      sgst: 0,
      igst: 0,
      tax: 0,
    };
    for (const field of ['taxable', 'cgst', 'sgst', 'igst', 'tax'] as const)
      row[field] = round(row[field] + values[field]);
    rows.set(key, row);
  }
  return [...rows.values()];
}

const small = [
  'Zero',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
  'Thirteen',
  'Fourteen',
  'Fifteen',
  'Sixteen',
  'Seventeen',
  'Eighteen',
  'Nineteen',
];
const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
function words(n: number): string {
  if (n < 20) return small[n];
  if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ` ${small[n % 10]}` : '');
  for (const [size, label] of [
    [10000000, 'Crore'],
    [100000, 'Lakh'],
    [1000, 'Thousand'],
    [100, 'Hundred'],
  ] as const) {
    if (n >= size)
      return `${words(Math.floor(n / size))} ${label}${n % size ? ` ${words(n % size)}` : ''}`;
  }
  return '';
}
export function amountInWords(amount: number): string {
  if (!Number.isFinite(amount) || amount < 0 || amount > 1e12)
    throw new Error('Invalid invoice amount.');
  const paise = Math.round((amount + Number.EPSILON) * 100);
  return `${words(Math.floor(paise / 100))} Rupees${paise % 100 ? ` and ${words(paise % 100)} Paise` : ''} Only`;
}
