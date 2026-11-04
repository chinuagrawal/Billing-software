import type { Invoice } from '../types';

function filenamePart(value: string, fallback: string) {
  const safe = value
    .normalize('NFC')
    .replace(/[<>:"/\\|?*\u0000-\u001f\u007f]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/[-. ]+$/g, '')
    .replace(/^-+/, '')
    .replace(/-+/g, '-');
  return Array.from(safe || fallback)
    .slice(0, 65)
    .join('');
}
export function invoiceFilename(invoice: Invoice, sample = false) {
  const kind =
    invoice.status === 'draft'
      ? 'Draft'
      : invoice.status === 'void'
        ? 'Cancelled-Invoice'
        : 'Invoice';
  const number = invoice.status === 'draft' ? invoice.id : invoice.number;
  return `${sample ? 'DEMO_' : ''}${kind}_${filenamePart(number, 'Bill')}_${filenamePart(invoice.customer.name, 'Customer')}_${filenamePart(invoice.date, 'Date')}.pdf`;
}
export function saveInvoiceFile(file: File) {
  const url = URL.createObjectURL(file),
    anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = file.name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
export async function shareInvoiceFile(file: File): Promise<'shared' | 'downloaded' | 'cancelled'> {
  if (!navigator.share || !navigator.canShare?.({ files: [file] })) {
    saveInvoiceFile(file);
    return 'downloaded';
  }
  try {
    // Called directly from a click with a prepared File to preserve user activation.
    await navigator.share({ files: [file], title: file.name.replace(/\.pdf$/i, '') });
    return 'shared';
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') return 'cancelled';
    throw new Error(
      'Your browser could not open file sharing. Use Save PDF and attach the file in your messaging or email app.',
    );
  }
}
