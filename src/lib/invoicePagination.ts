export interface PrintBlock {
  top: number;
  bottom: number;
}
export interface PrintPage {
  start: number;
  end: number;
  headerHeight: number;
}
export function paginateInvoice(
  height: number,
  capacity: number,
  blocks: PrintBlock[],
  header?: PrintBlock,
  tableBottom = 0,
): PrintPage[] {
  if (!Number.isFinite(height) || height <= 0 || !Number.isFinite(capacity) || capacity <= 0)
    throw new Error('Invalid invoice page dimensions.');
  const pages: PrintPage[] = [];
  // Small overflows fit on one sheet with at most a 10% reduction in size.
  // The PDF image uses an A4 bounding box to preserve the full bill's proportions.
  if (height <= capacity / 0.9) return [{ start: 0, end: height, headerHeight: 0 }];
  let start = 0;
  while (start < height - 0.01) {
    const headerHeight =
      header && start >= header.bottom - 0.01 && start < tableBottom - 0.01
        ? header.bottom - header.top
        : 0;
    const space = capacity - headerHeight;
    if (space <= 0) throw new Error('Invoice table header exceeds page size.');
    let end = Math.min(height, start + space);
    for (let n = 0; n <= blocks.length; n++) {
      const crossed = blocks.filter(
        (b) =>
          b.top > start + 0.01 &&
          b.top < end - 0.01 &&
          b.bottom > end + 0.01 &&
          b.bottom - b.top <= space,
      );
      if (!crossed.length) break;
      end = Math.min(...crossed.map((b) => b.top));
    }
    if (end <= start + 0.01) end = Math.min(height, start + space);
    pages.push({ start, end, headerHeight });
    start = end;
    if (pages.length > 100) throw new Error('This invoice is too long to export.');
  }
  return pages;
}
