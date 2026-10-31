import ExcelJS from 'exceljs';
import type { Workspace } from '../types';
import { buildGstr1Report } from './gstr1';
import type { Gstr1Options, ReportSheet } from './gstr1';

const currencyFormat = '#,##0.00;[Red](#,##0.00);0.00';
const letter = (n: number): string =>
  n > 26
    ? letter(Math.floor((n - 1) / 26)) + letter(((n - 1) % 26) + 1)
    : String.fromCharCode(64 + n);
const shade = 'EDF3EA';
export function createGstr1Workbook(data: Workspace, options: Gstr1Options) {
  const report = buildGstr1Report(data, options),
    workbook = new ExcelJS.Workbook();
  workbook.creator = 'Agrawal Billing';
  workbook.created = new Date();
  workbook.calcProperties.fullCalcOnLoad = true;
  const first = 7;
  function sheet(source: ReportSheet) {
    const ws = workbook.addWorksheet(source.name, {
      views: [{ state: 'frozen', ySplit: first - 1, xSplit: 1, showGridLines: false }],
      properties: { defaultRowHeight: 22 },
      pageSetup: {
        paperSize: 9,
        orientation: 'landscape',
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
      },
    });
    ws.getCell('A2').value = `${options.demo ? 'DEMO · ' : ''}GSTR-1 preparation · ${source.name}`;
    ws.getCell('A2').font = { name: 'Arial', size: 15, bold: true, color: { argb: '234D39' } };
    ws.getRow(2).height = 27;
    // Separate metadata cells are easy to copy and never merge working columns.
    ws.getCell('A3').value = 'Supplier GSTIN';
    ws.getCell('B3').value = options.gstin || 'Not set (demo)';
    ws.getCell('A4').value = 'Invoice dates';
    ws.getCell('B4').value = `${options.from} to ${options.to}`;
    ws.getCell('A5').value = options.demo ? 'Sample data only' : 'For filing preparation';
    ws.getCell('B5').value = 'Review exceptions and Filing notes. Not a portal upload template.';
    const header = ws.getRow(6);
    header.values = source.headers;
    header.height = 38;
    header.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '234D39' } };
      cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFF' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    });
    source.rows.forEach((row, index) => {
      const r = ws.addRow(row.map((value) => (value === '' ? null : value)));
      r.eachCell((cell) => {
        cell.font = { name: 'Arial', size: 10, color: { argb: '253A30' } };
        cell.alignment = {
          vertical: 'middle',
          horizontal: typeof cell.value === 'number' ? 'right' : 'left',
          indent: typeof cell.value === 'number' ? 0 : 1,
        };
        if (index % 2 === 0)
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F4F7F2' } };
      });
    });
    ws.autoFilter = {
      from: { row: 6, column: 1 },
      to: { row: Math.max(6, source.rows.length + 6), column: source.headers.length },
    };
    source.headers.forEach((name, index) => {
      let width = Math.max(16, Math.min(27, name.length + 2));
      if (/name|Description|Item|Invoice number|From number|To number/i.test(name)) width = 29;
      if (/GSTIN/i.test(name)) width = 24;
      if (/Place of supply/i.test(name)) width = 32;
      if (name === 'Nature of document') width = 34;
      if (name === 'Action') width = 85;
      ws.getColumn(index + 1).width = width;
    });
    for (let row = first; row <= ws.rowCount; row++) {
      let height = 22;
      ws.getRow(row).eachCell((cell, col) => {
        if (typeof cell.value !== 'string') return;
        const lines = Math.ceil(
          cell.value.length / Math.max(10, (ws.getColumn(col).width || 20) - 3),
        );
        if (lines > 1) {
          cell.alignment = { ...cell.alignment, wrapText: true };
          height = Math.max(height, lines * 14 + 6);
        }
      });
      ws.getRow(row).height = height;
    }
    // Metadata spans the opening view; body columns retain their own widths.
    if (source.name === 'Review' || source.name === 'Filing notes') {
      ws.getColumn(1).width = 32;
      ws.getColumn(2).width = source.name === 'Review' ? 52 : 110;
      if (source.name === 'Review') ws.getColumn(3).width = 95;
      for (let row = first; row <= ws.rowCount; row++) {
        ws.getRow(row).height = source.name === 'Review' ? 44 : 62;
        ws.getRow(row).eachCell((c) => {
          c.alignment = { vertical: 'top', wrapText: true };
        });
      }
    }
    for (const col of source.moneyColumns || [])
      for (let row = first; row <= ws.rowCount; row++) ws.getCell(row, col).numFmt = currencyFormat;
    for (const col of source.dateColumns || [])
      for (let row = first; row <= ws.rowCount; row++) ws.getCell(row, col).numFmt = 'dd-mmm-yyyy';
    for (let r = 3; r <= 5; r++)
      ws.getRow(r).eachCell((c) => {
        c.font = { name: 'Arial', size: 10, color: { argb: '526356' } };
      });
    ws.pageSetup.printTitlesRow = '1:6';
    ws.headerFooter.oddFooter = '&LAgrawal Billing · GSTR-1 preparation&RPage &P of &N';
    return ws;
  }
  for (const s of report.sheets) sheet(s);
  const sum = (sheetName: string, col: number) => {
    const source = report.sheets.find((s) => s.name === sheetName)!;
    return source.rows.length
      ? `SUM('${sheetName}'!${letter(col)}${first}:${letter(col)}${first + source.rows.length - 1})`
      : '0';
  };
  const summary = workbook.getWorksheet('Summary')!;
  const sectionColumns: Record<string, number[]> = {
    B2B: [11, 12, 13, 14],
    B2CL: [7, 8, 9, 10],
    B2CS: [5, 6, 7, 8],
  };
  ['B2B', 'B2CL', 'B2CS'].forEach((name, index) => {
    const source = report.sectionTotals[name as 'B2B' | 'B2CL' | 'B2CS'];
    [source.taxable, source.cgst, source.sgst, source.igst].forEach((result, n) => {
      summary.getCell(first + index, n + 2).value = {
        formula: sum(name, sectionColumns[name][n]),
        result,
      };
    });
    summary.getCell(first + index, 6).value = {
      formula: `SUM(B${first + index}:E${first + index})`,
      result: source.total,
    };
  });
  summary.getCell('B10').value = {
    formula: sum('Zero rate review', 7),
    result: report.sectionTotals['Zero rate review'].taxable,
  };
  summary.getCell('F10').value = {
    formula: 'SUM(B10:E10)',
    result: report.sectionTotals['Zero rate review'].total,
  };
  const registerRows = report.sheets.find((s) => s.name === 'Sales register')!.rows;
  summary.getCell('F11').value = {
    formula: registerRows.length
      ? `SUMIFS('Sales register'!O7:O${registerRows.length + 6},'Sales register'!D7:D${registerRows.length + 6},"issued")`
      : '0',
    result: report.roundOffTotal,
  };
  const totalRow = summary.addRow(['All issued sales', ...Object.values(report.actual)]);
  totalRow.eachCell((cell, col) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: shade } };
    cell.font = { name: 'Arial', size: 10, bold: true };
    if (col > 1) {
      cell.value = { formula: `SUM(${letter(col)}7:${letter(col)}11)`, result: Number(cell.value) };
      cell.numFmt = currencyFormat;
    }
  });
  const reconciliation = workbook.getWorksheet('Reconciliation')!;
  const register = report.sheets.find((s) => s.name === 'Sales register')!;
  const registerEnd = register.rows.length + 6;
  const reconciliationRows = report.sheets.find((s) => s.name === 'Reconciliation')!.rows;
  for (let n = 0; n < 5; n++) {
    const row = first + n,
      col = letter(10 + n),
      actual = Object.values(report.actual)[n];
    reconciliation.getCell(row, 2).value = {
      formula: register.rows.length
        ? `SUMIFS('Sales register'!${col}7:${col}${registerEnd},'Sales register'!D7:D${registerEnd},"issued")`
        : '0',
      result: actual,
    };
    reconciliation.getCell(row, 3).value = {
      formula: `'Summary'!${letter(2 + n)}12`,
      result: Number(reconciliationRows[n][2]),
    };
    reconciliation.getCell(row, 4).value = {
      formula: `ROUND(B${row}-C${row},2)`,
      result: Number(reconciliationRows[n][3]),
    };
    const hsnCol = [8, 9, 10, 11, 7][n];
    reconciliation.getCell(row, 5).value = {
      formula: `${sum('HSN B2B', hsnCol)}+${sum('HSN B2C', hsnCol)}`,
      result: Number(reconciliationRows[n][4]),
    };
    reconciliation.getCell(row, 6).value = {
      formula: `ROUND(B${row}-E${row}-G${row},2)`,
      result: Number(reconciliationRows[n][5]),
    };
    reconciliation.getCell(row, 7).value = {
      formula: n === 4 ? "'Summary'!F11" : '0',
      result: Number(reconciliationRows[n][6]),
    };
  }
  reconciliation.addConditionalFormatting({
    ref: 'D7:F11',
    rules: [
      {
        type: 'expression',
        priority: 1,
        formulae: ['AND(OR(COLUMN()=4,COLUMN()=6),ABS(D7)>0.01)'],
        style: {
          fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FCE5E3' } },
          font: { color: { argb: 'A32929' }, bold: true },
        },
      },
    ],
  });
  const docs = workbook.getWorksheet('Documents issued')!;
  const docRows = report.sheets.find((s) => s.name === 'Documents issued')!.rows;
  docRows.forEach((row, n) => {
    docs.getCell(first + n, 7).value = {
      formula: `E${first + n}-F${first + n}`,
      result: Number(row[6]),
    };
  });
  return workbook;
}

export async function downloadGstr1Excel(data: Workspace, options: Gstr1Options) {
  const wb = createGstr1Workbook(data, options);
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([new Uint8Array(buffer)], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob),
    a = document.createElement('a');
  a.href = url;
  a.download = `${options.demo ? 'DEMO-' : ''}GSTR1-${options.gstin}-${options.from}-${options.to}.xlsx`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
