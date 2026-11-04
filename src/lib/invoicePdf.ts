import pdfMake from 'pdfmake/build/pdfmake.js';
import type { Content, TDocumentDefinitions } from 'pdfmake/interfaces';
import type { Invoice, InvoiceTemplate } from '../types';
import { invoicePrintPages, PRINT_MARGIN_MM } from './invoicePrint';

export function invoicePdfDefinition(i: Invoice, pages: string[]): TDocumentDefinitions {
  const margin = (PRINT_MARGIN_MM * 72) / 25.4;
  const width = ((210 - 2 * PRINT_MARGIN_MM) * 72) / 25.4;
  if (!pages.length) throw new Error('Invoice PDF has no pages.');
  return {
    pageSize: 'A4',
    pageMargins: [margin, margin, margin, margin],
    content: pages.map(
      (image, n) =>
        ({
          image,
          width,
          margin: [0, 0, 0, 0],
          ...(n ? { pageBreak: 'before' as const } : {}),
        }) as Content,
    ),
    info: {
      title: `${i.status === 'draft' ? 'Draft invoice' : i.status === 'void' ? 'Void invoice' : 'Tax invoice'} ${i.number} - ${i.customer.name}`,
      author: i.business.name,
      subject: 'Invoice print layout',
    },
    compress: true,
  };
}
export async function invoicePdfBlob(
  invoice: Invoice,
  template: InvoiceTemplate,
  sample = false,
): Promise<Blob> {
  const pages = await invoicePrintPages(invoice, template, sample);
  return pdfMake.createPdf(invoicePdfDefinition(invoice, pages)).getBlob();
}
