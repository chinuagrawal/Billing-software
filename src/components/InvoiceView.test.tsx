import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { demoWorkspace } from '../lib/seed';
import { InvoiceView } from './InvoiceView';

vi.mock('../lib/store', () => ({
  useStore: () => ({ execute: vi.fn(), mode: 'demo', data: demoWorkspace() }),
}));
const render = (status: 'draft' | 'issued' | 'void', paid = 0) =>
  renderToStaticMarkup(
    <InvoiceView
      invoice={{ ...demoWorkspace().invoices[0], status, paid }}
      onEdit={() => {}}
      onPay={() => {}}
      onDone={() => {}}
    />,
  );
describe('Invoice actions', () => {
  it('exposes a labelled draft delete button', () => {
    const html = render('draft');
    expect(html).toContain('Delete draft');
    expect(html).toContain('Edit draft');
    expect(html).not.toContain('Cancel invoice');
  });
  it('exposes a labelled cancel button only for unpaid issued invoices', () => {
    expect(render('issued')).toContain('Cancel invoice');
    const html = render('issued', 100);
    expect(html).not.toContain('Cancel invoice');
    expect(html).not.toContain('Delete draft');
    expect(html).toContain('recorded payments');
  });
  it('explains why a cancelled invoice remains visible', () => {
    const html = render('void');
    expect(html).toContain('cancelled (Void)');
    expect(html).not.toContain('Delete draft');
  });
});
