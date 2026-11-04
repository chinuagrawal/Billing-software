import { renderToStaticMarkup } from 'react-dom/server';
import { InvoiceDocument } from '../components/InvoiceDocument';
import type { Invoice, InvoiceTemplate } from '../types';
import baseStyles from '../styles.css?inline';
import templateStyles from '../invoice-templates.css?inline';
import { paginateInvoice } from './invoicePagination';

// The exact styles used by Print / PDF, in an isolated desktop-size print document.
export const invoicePrintCss = (baseStyles + '\n' + templateStyles)
  .replace(/@import\s*(?:url\([^)]*\)|"[^"]*"|'[^']*')\s*;/g, '')
  .replace(/@media\s+print\b/g, '@media all');
export const PRINT_MARGIN_MM = 12;
export const PRINT_WIDTH_PX = ((210 - 2 * PRINT_MARGIN_MM) * 96) / 25.4;
export const PRINT_HEIGHT_PX = ((297 - 2 * PRINT_MARGIN_MM) * 96) / 25.4 - 2;
export function invoicePrintMarkup(invoice: Invoice, template: InvoiceTemplate, sample = false) {
  return renderToStaticMarkup(
    <InvoiceDocument invoice={invoice} template={template} sample={sample} />,
  );
}
export async function invoicePrintPages(
  invoice: Invoice,
  template: InvoiceTemplate,
  sample = false,
): Promise<string[]> {
  const { default: html2canvas } = await import('html2canvas');
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.tabIndex = -1;
  frame.sandbox.add('allow-same-origin');
  frame.style.cssText =
    'position:fixed;left:-12000px;top:0;width:1100px;height:1200px;border:0;pointer-events:none;';
  const loaded = new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(
      () => reject(new Error('Invoice print layout timed out.')),
      15000,
    );
    frame.onload = () => {
      clearTimeout(timeout);
      resolve();
    };
    frame.onerror = () => {
      clearTimeout(timeout);
      reject(new Error('Unable to load invoice print layout.'));
    };
  });
  frame.srcdoc = `<!doctype html><html lang="en"><head><meta charset="utf-8"><style>${invoicePrintCss}\nhtml,body{width:${PRINT_WIDTH_PX}px!important;margin:0!important;padding:0!important;background:white!important;}body{font-family:Arial,sans-serif;}.invoice-paper.invoice-document{margin:0!important;}*{animation:none!important;transition:none!important;}</style></head><body>${invoicePrintMarkup(invoice, template, sample)}</body></html>`;
  document.body.appendChild(frame);
  try {
    await loaded;
    const doc = frame.contentDocument;
    if (!doc) throw new Error('Invoice print document is unavailable.');
    await doc.fonts.ready;
    const paper = doc.getElementById('print-invoice');
    if (!paper) throw new Error('Invoice print layout is missing.');
    // The Classic template's empty filler is decorative. Reduce it before adding
    // another page solely for the signature/footer on an otherwise short bill.
    const spacer = paper.querySelector<HTMLElement>('.bill-spacer');
    const overflow = paper.getBoundingClientRect().height - PRINT_HEIGHT_PX;
    if (spacer && overflow > 0) {
      const height = Math.max(28, spacer.getBoundingClientRect().height - overflow - 2);
      spacer.querySelectorAll<HTMLElement>('td').forEach((cell) => {
        cell.style.height = `${height}px`;
      });
    }
    const bounds = paper.getBoundingClientRect();
    const block = (element: Element) => {
      const r = element.getBoundingClientRect();
      return { top: r.top - bounds.top, bottom: r.bottom - bounds.top };
    };
    const blocks = Array.from(
      paper.querySelectorAll(
        '.bill-seller,.bill-parties,.bill-items tr,.bill-summary-grid,.bill-tax-summary tr,.bill-words,.bill-signature,footer,p',
      ),
    ).map(block);
    const head = paper.querySelector('.bill-items thead'),
      table = paper.querySelector('.bill-items');
    const pages = paginateInvoice(
      bounds.height,
      PRINT_HEIGHT_PX,
      blocks,
      head ? block(head) : undefined,
      table ? block(table).bottom : 0,
    );
    // Render the complete document once, then crop at measured row boundaries.
    const width = Math.ceil(bounds.width),
      height = Math.ceil(bounds.height);
    const scale = Math.min(3, Math.sqrt(12_000_000 / (width * height)), 28000 / height);
    const source = await html2canvas(paper, {
      backgroundColor: '#ffffff',
      scale,
      width,
      height,
      windowWidth: 1100,
      windowHeight: height + 20,
      scrollX: 0,
      scrollY: 0,
      logging: false,
      removeContainer: true,
      onclone: (cloned) => {
        cloned
          .querySelectorAll<HTMLElement>('#print-invoice table th,#print-invoice table td')
          .forEach((cell) => cell.style.setProperty('border-color', 'transparent', 'important'));
      },
    });
    // Canvas renderers approximate collapsed table borders. Paint those borders
    // from the browser's real cell rectangles so their grid lines stay aligned.
    const sourceContext = source.getContext('2d');
    if (!sourceContext) throw new Error('PDF image rendering is unavailable.');
    sourceContext.save();
    sourceContext.setTransform(scale, 0, 0, scale, 0, 0);
    const painted = new Set<string>();
    for (const cell of paper.querySelectorAll<HTMLElement>('table th,table td')) {
      const r = cell.getBoundingClientRect(),
        style = doc.defaultView!.getComputedStyle(cell);
      const x = r.left - bounds.left,
        y = r.top - bounds.top;
      for (const [side, line] of [
        ['Top', [x, y, x + r.width, y]],
        ['Bottom', [x, y + r.height, x + r.width, y + r.height]],
        ['Left', [x, y, x, y + r.height]],
        ['Right', [x + r.width, y, x + r.width, y + r.height]],
      ] as const) {
        const size = parseFloat(style.getPropertyValue(`border-${side.toLowerCase()}-width`));
        const color = style.getPropertyValue(`border-${side.toLowerCase()}-color`);
        const kind = style.getPropertyValue(`border-${side.toLowerCase()}-style`);
        const key = JSON.stringify([line.map((n) => Math.round(n * 100) / 100), size, color]);
        if (
          !size ||
          kind === 'none' ||
          kind === 'hidden' ||
          color === 'transparent' ||
          painted.has(key)
        )
          continue;
        painted.add(key);
        sourceContext.strokeStyle = color;
        sourceContext.lineWidth = size;
        sourceContext.beginPath();
        sourceContext.moveTo(line[0], line[1]);
        sourceContext.lineTo(line[2], line[3]);
        sourceContext.stroke();
      }
    }
    sourceContext.restore();
    const images: string[] = [];
    try {
      for (const page of pages) {
        const from = Math.round(page.start * scale),
          to = Math.min(source.height, Math.round(page.end * scale));
        const heading = Math.ceil(page.headerHeight * scale);
        const canvas = document.createElement('canvas');
        canvas.width = source.width;
        canvas.height = to - from + heading;
        const context = canvas.getContext('2d');
        if (!context) throw new Error('PDF image rendering is unavailable.');
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, canvas.width, canvas.height);
        if (heading && head)
          context.drawImage(
            source,
            0,
            Math.round(block(head).top * scale),
            source.width,
            heading,
            0,
            0,
            canvas.width,
            heading,
          );
        context.drawImage(
          source,
          0,
          from,
          source.width,
          to - from,
          0,
          heading,
          canvas.width,
          to - from,
        );
        images.push(canvas.toDataURL('image/png'));
        canvas.width = canvas.height = 0;
      }
    } finally {
      source.width = source.height = 0;
    }
    return images;
  } finally {
    frame.remove();
  }
}
