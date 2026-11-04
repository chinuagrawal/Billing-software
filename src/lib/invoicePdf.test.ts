import { describe, it, expect, vi } from 'vitest';
vi.mock('../styles.css?inline', async () => ({
  default: await (
    await import('node:fs/promises')
  ).readFile(new URL('../styles.css', import.meta.url), 'utf-8'),
}));
vi.mock('../invoice-templates.css?inline', async () => ({
  default: await (
    await import('node:fs/promises')
  ).readFile(new URL('../invoice-templates.css', import.meta.url), 'utf-8'),
}));
import pdfMake from 'pdfmake/build/pdfmake.js';
import { invoicePdfDefinition } from './invoicePdf';
import { invoicePrintMarkup, invoicePrintCss, PRINT_WIDTH_PX } from './invoicePrint';
import { demoWorkspace } from './seed';
import { invoiceTotals, money, roundedInvoiceTotals } from './billing';
import { INVOICE_TEMPLATES } from './invoiceTemplates';
const image =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4//8/AAX+Av4N70a4AAAAAElFTkSuQmCC';
describe('Shared print layout PDFs', () => {
  it('uses the actual invoice document and its print CSS for each selected style', () => {
    const i = demoWorkspace().invoices[0];
    i.roundOff = roundedInvoiceTotals(i.items, i.business.state !== i.placeOfSupply).roundOff;
    for (const { id } of INVOICE_TEMPLATES) {
      const html = invoicePrintMarkup(i, id, true);
      expect(html).toContain(`invoice-template-${id}`);
      expect(html).toContain(i.customer.name);
      expect(html).toContain('bill-seller');
      expect(html).toContain('Round off');
      expect(html).toContain(money(invoiceTotals(i).total));
    }
    expect(invoicePrintCss).toContain('@media all');
    expect(invoicePrintCss).not.toMatch(/@media\s+print\b/);
    expect(invoicePrintCss).not.toContain('@import');
    expect(invoicePrintCss).toContain('border: 1px solid var(--bill-rule)');
    expect(PRINT_WIDTH_PX).toBeCloseTo(702.99, 1);
  });
  it('keeps 12mm page margins and reuses page images without a second invoice layout', () => {
    const doc = invoicePdfDefinition(demoWorkspace().invoices[0], [image, image]);
    expect(doc.pageSize).toBe('A4');
    expect(doc.pageMargins).toEqual([
      (12 * 72) / 25.4,
      (12 * 72) / 25.4,
      (12 * 72) / 25.4,
      (12 * 72) / 25.4,
    ]);
    expect(JSON.stringify(doc.content)).toContain('"pageBreak":"before"');
    expect(doc.footer).toBeUndefined();
    expect(JSON.stringify(doc.content)).not.toContain('table');
  });
  it('creates a real PDF from the rendered page image', async () => {
    const blob = await pdfMake
      .createPdf(invoicePdfDefinition(demoWorkspace().invoices[0], [image]))
      .getBlob();
    expect(blob.type).toBe('application/pdf');
    expect(await blob.slice(0, 5).text()).toBe('%PDF-');
  });
});
