import { describe, it, expect } from 'vitest';
import { paginateInvoice } from './invoicePagination';
describe('Invoice print pagination', () => {
  it('keeps a short invoice on one page', () => {
    expect(paginateInvoice(700, 1000, [])).toEqual([{ start: 0, end: 700, headerHeight: 0 }]);
  });
  it('preserves rows and summary blocks and repeats the table heading on continuations', () => {
    const pages = paginateInvoice(
      2250,
      1000,
      [
        { top: 900, bottom: 1100 },
        { top: 1850, bottom: 2150 },
      ],
      { top: 200, bottom: 230 },
      1800,
    );
    expect(pages[0]).toEqual({ start: 0, end: 900, headerHeight: 0 });
    expect(pages[1]).toEqual({ start: 900, end: 1850, headerHeight: 30 });
    expect(pages[2]).toEqual({ start: 1850, end: 2250, headerHeight: 0 });
  });
  it('handles oversized content without empty pages or an infinite loop', () => {
    const pages = paginateInvoice(2500, 1000, [{ top: 0, bottom: 2500 }]);
    expect(pages.map((p) => p.end - p.start)).toEqual([1000, 1000, 500]);
    expect(() => paginateInvoice(10, 0, [])).toThrow();
  });
});
