import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { InvoiceDocument } from '../components/InvoiceDocument';
import { amountInWords, INVOICE_TEMPLATES, resolveTemplate, taxSummary } from './invoiceTemplates';
import { demoWorkspace } from './seed';
import { applyCommand, invoiceTotals, money, round } from './billing';

describe('invoice styles and amount words', () => {
  it('formats zero, paise and Indian lakh/crore amounts', () => {
    expect(amountInWords(0)).toBe('Zero Rupees Only');
    expect(amountInWords(4310)).toBe('Four Thousand Three Hundred Ten Rupees Only');
    expect(amountInWords(12345678.09)).toBe(
      'One Crore Twenty Three Lakh Forty Five Thousand Six Hundred Seventy Eight Rupees and Nine Paise Only',
    );
    expect(amountInWords(99.999)).toBe('One Hundred Rupees Only');
    expect(() => amountInWords(NaN)).toThrow();
  });
  it('keeps legacy invoices on a valid default style', () => {
    expect(resolveTemplate()).toBe('modern');
    expect(resolveTemplate('unknown')).toBe('modern');
    expect(resolveTemplate('classic')).toBe('classic');
  });
  it('persists a style without rewriting issued invoices', () => {
    const workspace = demoWorkspace();
    const before = structuredClone(workspace.invoices);
    const next = applyCommand(workspace, {
      type: 'saveBusiness',
      business: { ...workspace.business, invoiceTemplate: 'classic' },
    });
    expect(next.business.invoiceTemplate).toBe('classic');
    expect(next.invoices).toEqual(before);
  });
  it('renders all three styles with the same invoice total and legal details', () => {
    const invoice = demoWorkspace().invoices.find((i) => i.status === 'issued')!;
    for (const template of INVOICE_TEMPLATES) {
      const html = renderToStaticMarkup(
        <InvoiceDocument invoice={invoice} template={template.id} sample />,
      );
      expect(html).toContain(`data-template="${template.id}"`);
      expect(html).toContain(money(invoiceTotals(invoice).total));
      expect(html).toContain(invoice.number);
      expect(html).toContain(invoice.business.name);
      expect(html).toContain('DEMONSTRATION ONLY');
      expect(html).toContain('Invoice amount in words');
      expect(html).toContain('Authorised signatory');
    }
  });
  it('reconciles HSN groups to the exact line-rounded invoice tax', () => {
    const invoice = demoWorkspace().invoices.find((i) => i.status === 'issued')!;
    invoice.items = [
      { ...invoice.items[0], hsn: '3307', price: 35.59, qty: 95, gst: 18, discount: 0 },
      { ...invoice.items[0], hsn: '3307', price: 33.9, qty: 8, gst: 18, discount: 0 },
      { ...invoice.items[0], hsn: '3307', price: 20.01, qty: 3, gst: 5, discount: 10 },
    ];
    for (const state of [invoice.business.state, invoice.business.state === '27' ? '08' : '27']) {
      invoice.placeOfSupply = state;
      const groups = taxSummary(invoice),
        sum = invoiceTotals(invoice);
      expect(groups).toHaveLength(2);
      for (const key of ['taxable', 'cgst', 'sgst', 'igst', 'tax'] as const)
        expect(round(groups.reduce((s, row) => s + row[key], 0))).toBe(sum[key]);
    }
  });
});
