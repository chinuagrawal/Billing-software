import { describe, it, expect } from 'vitest';
import { invoicePdfBlob, invoicePdfDefinition } from './invoicePdf';
import { demoWorkspace } from './seed';
import { invoiceTotals, money, roundedInvoiceTotals } from './billing';
import { INVOICE_TEMPLATES } from './invoiceTemplates';
describe('Downloadable invoice PDFs', () => {
  it('uses the same totals and round-off in every selected style', () => {
    const i = demoWorkspace().invoices[0];
    i.roundOff = roundedInvoiceTotals(i.items, i.business.state !== i.placeOfSupply).roundOff;
    for (const { id } of INVOICE_TEMPLATES) {
      const doc = invoicePdfDefinition(i, id, true),
        json = JSON.stringify(doc);
      expect(json).toContain(i.customer.name);
      expect(json).toContain(i.number);
      expect(json).toContain('Round off');
      expect(json).toContain(money(invoiceTotals(i).total));
      expect(json).toContain('SAMPLE');
      expect(doc.pageSize).toBe('A4');
    }
  });
  it('creates a real PDF blob for downloading and sharing', async () => {
    const blob = await invoicePdfBlob(demoWorkspace().invoices[0], 'classic', true);
    expect(blob.type).toBe('application/pdf');
    expect(blob.size).toBeGreaterThan(5000);
    expect(await blob.slice(0, 5).text()).toBe('%PDF-');
  });
});
