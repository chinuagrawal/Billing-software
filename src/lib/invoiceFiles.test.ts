import { afterEach, describe, expect, it, vi } from 'vitest';
import { invoiceFilename, saveInvoiceFile, shareInvoiceFile } from './invoiceFiles';
import { demoWorkspace } from './seed';
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
describe('Invoice file names and sharing', () => {
  it('assigns a stable invoice/customer/date filename and distinguishes draft, demo and cancelled bills', () => {
    const i = demoWorkspace().invoices[0];
    expect(invoiceFilename(i)).toBe(`Invoice_AE-26-27-1048_Urban-Living-Co_${i.date}.pdf`);
    expect(invoiceFilename({ ...i, status: 'void' })).toMatch(/^Cancelled-Invoice_/);
    expect(invoiceFilename({ ...i, status: 'draft', id: 'draft-unique-one' })).not.toBe(
      invoiceFilename({ ...i, status: 'draft', id: 'draft-unique-two' }),
    );
    expect(invoiceFilename(i, true)).toMatch(/^DEMO_/);
    i.customer.name = 'A / <B>:C\\D|E?*\n';
    expect(invoiceFilename(i)).not.toMatch(/[<>:"/\\|?*\u0000-\u001f]/);
    expect(invoiceFilename(i)).toMatch(/\.pdf$/);
  });
  it('passes the prepared PDF file to the native share menu', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { share, canShare: () => true });
    const file = new File(['sample'], 'Invoice_test.pdf', { type: 'application/pdf' });
    expect(await shareInvoiceFile(file)).toBe('shared');
    expect(share).toHaveBeenCalledWith({ files: [file], title: 'Invoice_test' });
  });
  it('treats cancelled sharing as cancellation and reports other failures', async () => {
    vi.stubGlobal('navigator', {
      canShare: () => true,
      share: vi.fn().mockRejectedValue(new DOMException('Cancelled', 'AbortError')),
    });
    const file = new File(['sample'], 'invoice.pdf', { type: 'application/pdf' });
    expect(await shareInvoiceFile(file)).toBe('cancelled');
    vi.stubGlobal('navigator', {
      canShare: () => true,
      share: vi.fn().mockRejectedValue(new Error('Blocked')),
    });
    await expect(shareInvoiceFile(file)).rejects.toThrow('Use Save PDF');
  });
  it('downloads with the assigned filename when file sharing is unavailable', async () => {
    vi.useFakeTimers();
    const anchor = { href: '', download: '', click: vi.fn(), remove: vi.fn() };
    vi.stubGlobal('document', { createElement: () => anchor, body: { appendChild: vi.fn() } });
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    vi.stubGlobal('navigator', {});
    const file = new File(['sample'], 'Invoice_assigned.pdf', { type: 'application/pdf' });
    expect(await shareInvoiceFile(file)).toBe('downloaded');
    expect(anchor.download).toBe(file.name);
    expect(anchor.click).toHaveBeenCalledOnce();
    vi.runAllTimers();
    expect(revoke).toHaveBeenCalledWith('blob:test');
    saveInvoiceFile(file);
    expect(anchor.click).toHaveBeenCalledTimes(2);
    vi.runAllTimers();
  });
});
