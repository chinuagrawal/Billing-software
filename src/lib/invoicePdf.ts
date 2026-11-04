import pdfMake from 'pdfmake/build/pdfmake.js';
import pdfFonts from 'pdfmake/build/vfs_fonts.js';
import type {
  Content,
  CustomTableLayout,
  TableCell,
  TDocumentDefinitions,
} from 'pdfmake/interfaces';
import type { Invoice, InvoiceTemplate } from '../types';
import { balance, dateLabel, invoiceTotals, money, STATES, totals } from './billing';
import { amountInWords, taxSummary } from './invoiceTemplates';

pdfMake.addVirtualFileSystem(pdfFonts);

export function invoicePdfDefinition(
  i: Invoice,
  template: InvoiceTemplate,
  sample = false,
): TDocumentDefinitions {
  const modern = template === 'modern',
    classic = template === 'classic',
    accent = modern ? '#234D39' : '#292D2A';
  const interstate = i.business.state !== i.placeOfSupply,
    union = ['04', '26', '31', '35', '38'].includes(i.placeOfSupply),
    stateTax = union ? 'UTGST' : 'SGST';
  const t = invoiceTotals(i),
    heading =
      i.status === 'draft'
        ? 'DRAFT INVOICE'
        : i.status === 'void'
          ? 'CANCELLED INVOICE'
          : 'TAX INVOICE';
  const cell = (
    text: string | number,
    alignment: 'left' | 'right' = 'left',
    bold = false,
  ): TableCell => ({ text: String(text), alignment, bold });
  const header = (text: string): TableCell => ({
    text,
    bold: true,
    color: modern ? '#FFFFFF' : accent,
    fillColor: modern ? accent : classic ? '#EEF0ED' : '#FFFFFF',
    margin: [0, 3, 0, 3],
  });
  const layout: CustomTableLayout = {
    hLineWidth: (n, node) =>
      classic
        ? 0.6
        : n === 0 || n === node.table.headerRows || n === node.table.body.length
          ? 0.7
          : 0.25,
    vLineWidth: () => (classic ? 0.5 : 0),
    hLineColor: () => (classic ? '#8D968E' : '#D5DBD4'),
    vLineColor: () => '#8D968E',
    paddingLeft: () => 5,
    paddingRight: () => 5,
    paddingTop: () => 6,
    paddingBottom: () => 6,
  };
  const itemRows: TableCell[][] = i.items.map((item, n) => {
    const line = totals([item], interstate);
    return [
      cell(n + 1),
      {
        stack: [
          { text: item.name, bold: true },
          ...(item.discount
            ? [
                {
                  text: `Discount ${item.discount}% (${money(line.discount)})`,
                  fontSize: 7.5,
                  color: '#657064',
                },
              ]
            : []),
        ],
      },
      cell(item.hsn),
      cell(item.qty, 'right'),
      cell(item.unit),
      cell(money(item.price), 'right'),
      {
        stack: [
          { text: money(line.tax), alignment: 'right' },
          { text: `${item.gst}%`, alignment: 'right', fontSize: 7.5 },
        ],
      },
      cell(money(line.total), 'right'),
    ];
  });
  if (classic && i.items.length < 5)
    itemRows.push(
      Array.from({ length: 8 }, () => ({
        text: ' ',
        margin: [0, Math.max(10, 40 - i.items.length * 8), 0, 0],
      })),
    );
  const sameUnit = i.items.every((item) => item.unit === i.items[0]?.unit);
  const quantity = sameUnit
    ? i.items
        .reduce((n, item) => n + item.qty, 0)
        .toLocaleString('en-IN', { maximumFractionDigits: 6 })
    : '-';
  itemRows.push([
    cell(''),
    cell('Total', 'left', true),
    cell(''),
    cell(quantity, 'right'),
    cell(sameUnit ? i.items[0]?.unit || '' : 'Mixed'),
    cell(''),
    cell(money(t.tax), 'right', true),
    cell(money(t.unroundedTotal), 'right', true),
  ]);
  const taxRows = taxSummary(i).map((row) => [
    cell(row.hsn),
    cell(money(row.taxable), 'right'),
    ...(interstate
      ? [cell(`${money(row.igst)}\n${row.rate}%`, 'right')]
      : [
          cell(`${money(row.cgst)}\n${row.rate / 2}%`, 'right'),
          cell(`${money(row.sgst)}\n${row.rate / 2}%`, 'right'),
        ]),
    cell(money(row.tax), 'right'),
  ]);
  taxRows.push([
    cell('Total', 'left', true),
    cell(money(t.taxable), 'right', true),
    ...(interstate
      ? [cell(money(t.igst), 'right', true)]
      : [cell(money(t.cgst), 'right', true), cell(money(t.sgst), 'right', true)]),
    cell(money(t.tax), 'right', true),
  ]);
  const amountRows: TableCell[][] = [
    [cell('Subtotal'), cell(money(t.subtotal), 'right')],
    ...(t.discount ? [[cell('Discount'), cell(`- ${money(t.discount)}`, 'right')]] : []),
    [cell('Taxable value'), cell(money(t.taxable), 'right')],
    ...(interstate
      ? [[cell('IGST'), cell(money(t.igst), 'right')]]
      : [
          [cell('CGST'), cell(money(t.cgst), 'right')],
          [cell(stateTax), cell(money(t.sgst), 'right')],
        ]),
    ...(i.roundOff !== undefined
      ? [[cell('Round off'), cell(`${t.roundOff > 0 ? '+' : ''}${money(t.roundOff)}`, 'right')]]
      : []),
    [
      {
        text: 'Invoice total',
        bold: true,
        color: accent,
        fillColor: modern ? '#EDF3EA' : '#F1F2F0',
      },
      {
        text: money(t.total),
        alignment: 'right',
        bold: true,
        color: accent,
        fillColor: modern ? '#EDF3EA' : '#F1F2F0',
      },
    ],
    [cell('Received'), cell(money(i.paid), 'right')],
    [cell('Balance due'), cell(money(balance(i)), 'right', true)],
  ];
  const notes: Content[] = [];
  if (i.business.bankName || i.business.upi)
    notes.push(
      { text: 'Payment details', style: 'section', margin: [0, 12, 0, 5] },
      ...(i.business.bankName
        ? [
            {
              text: `${i.business.bankName}\nAccount: ${i.business.account}\nIFSC: ${i.business.ifsc}`,
            } as Content,
          ]
        : []),
      ...(i.business.upi ? [{ text: `UPI: ${i.business.upi}` } as Content] : []),
    );
  if (i.notes || i.business.terms)
    notes.push(
      { text: 'Notes & terms', style: 'section', margin: [0, 12, 0, 5] },
      ...[i.notes, i.business.terms]
        .filter(Boolean)
        .map((text) => ({ text, margin: [0, 0, 0, 5] }) as Content),
    );
  const content: Content[] = [
    ...(sample
      ? [
          {
            text: 'SAMPLE - DEMONSTRATION ONLY',
            alignment: 'center',
            color: '#945C36',
            fontSize: 9,
            bold: true,
            margin: [0, 0, 0, 8],
          } as Content,
        ]
      : []),
    {
      text: heading,
      alignment: 'right',
      fontSize: 10,
      bold: true,
      color: accent,
      margin: [0, 0, 0, 10],
    },
    {
      text: i.business.name,
      fontSize: modern ? 24 : 22,
      bold: true,
      color: accent,
      margin: [0, 0, 0, 5],
    },
    { text: i.business.address || 'Registered address not configured', margin: [0, 0, 0, 5] },
    {
      text: `Phone: ${i.business.phone || '-'}     Email: ${i.business.email || '-'}`,
      fontSize: 9,
    },
    {
      text: `GSTIN: ${i.business.gstin || 'Not configured'}     State: ${i.business.state}-${STATES[i.business.state] || '-'}`,
      fontSize: 9,
      margin: [0, 3, 0, 16],
    },
    {
      table: {
        widths: ['*', '*'],
        body: [
          [
            {
              stack: [
                { text: 'BILL TO', style: 'section' },
                { text: i.customer.name, bold: true, margin: [0, 6, 0, 3] },
                { text: i.customer.address },
                { text: `Contact: ${i.customer.phone || '-'}`, margin: [0, 4, 0, 0] },
                { text: `GSTIN: ${i.customer.gstin || 'Unregistered (B2C)'}` },
                { text: `State: ${i.customer.state}-${STATES[i.customer.state] || '-'}` },
                ...(i.shippingAddress && i.shippingAddress !== i.customer.address
                  ? [
                      {
                        text: `Ship to: ${i.shippingAddress}`,
                        margin: [0, 6, 0, 0] as [number, number, number, number],
                      },
                    ]
                  : []),
              ],
            },
            {
              stack: [
                { text: 'INVOICE DETAILS', style: 'section' },
                { text: `Invoice no.: ${i.number}`, bold: true, margin: [0, 6, 0, 3] },
                { text: `Invoice date: ${dateLabel(i.date)}` },
                { text: `Due date: ${dateLabel(i.dueDate)}` },
                { text: `Place of supply: ${i.placeOfSupply}-${STATES[i.placeOfSupply] || '-'}` },
                ...(i.reference ? [{ text: `Reference: ${i.reference}` }] : []),
                { text: 'Reverse charge: No' },
              ],
            },
          ],
        ],
      },
      layout: classic ? layout : 'noBorders',
      margin: [0, 0, 0, 16],
    },
    {
      table: {
        headerRows: 1,
        dontBreakRows: true,
        widths: [14, '*', 42, 30, 26, 59, 59, 65],
        body: [
          [
            ...['#', 'Item name', 'HSN / SAC', 'Qty', 'Unit', 'Price / unit', 'GST', 'Amount'].map(
              header,
            ),
          ],
          ...itemRows,
        ],
      },
      layout,
      fontSize: 8.5,
      margin: [0, 0, 0, 18],
    },
    {
      columns: [
        {
          width: '56%',
          stack: [
            { text: 'Tax summary', style: 'section', margin: [0, 0, 0, 6] },
            {
              table: {
                headerRows: 1,
                dontBreakRows: true,
                widths: interstate ? ['*', '*', '*', '*'] : ['*', '*', '*', '*', '*'],
                body: [
                  [
                    'HSN / SAC',
                    'Taxable',
                    ...(interstate ? ['IGST'] : ['CGST', stateTax]),
                    'Total tax',
                  ].map(header),
                  ...taxRows,
                ],
              },
              layout,
              fontSize: 7.5,
            },
            ...notes,
          ],
        },
        {
          width: '*',
          stack: [
            {
              table: { widths: ['*', 'auto'], body: amountRows },
              layout: 'lightHorizontalLines',
              fontSize: 9,
              margin: [0, 0, 0, 12],
            },
            {
              unbreakable: true,
              stack: [
                { text: 'Invoice amount in words', style: 'section', margin: [0, 0, 0, 5] },
                { text: amountInWords(t.total), fontSize: 9 },
              ],
            },
          ],
        },
      ],
      columnGap: 16,
    },
    {
      unbreakable: true,
      stack: [
        { text: `For ${i.business.name}`, bold: true, alignment: 'right', margin: [0, 14, 0, 26] },
        { text: 'Authorised signatory', alignment: 'right', fontSize: 9 },
      ],
    },
  ];
  return {
    pageSize: 'A4',
    pageMargins: [36, 32, 36, 40],
    defaultStyle: { font: 'Roboto', fontSize: 9.5, color: '#29352D', lineHeight: 1.15 },
    content,
    styles: { section: { bold: true, fontSize: 9, color: accent } },
    info: {
      title: `${heading} ${i.number} - ${i.customer.name}`,
      author: i.business.name,
      subject: 'B2B / B2C billing invoice',
    },
    footer: (page, pages) => ({
      text: `${sample ? 'SAMPLE | ' : ''}${i.number} | Original for recipient | All amounts in INR | ${page} / ${pages}`,
      alignment: 'center',
      fontSize: 8,
      color: '#657064',
      margin: [36, 12, 36, 0],
    }),
  };
}
export async function invoicePdfBlob(
  invoice: Invoice,
  template: InvoiceTemplate,
  sample = false,
): Promise<Blob> {
  return pdfMake.createPdf(invoicePdfDefinition(invoice, template, sample)).getBlob();
}
