import ExcelJS from 'exceljs';
import { Readable } from 'stream';
import { UITypes } from 'nocodb-sdk';
import { ExcelImportHandler } from './excel-import.handler';
import type { FileImportColumn } from 'nocodb-sdk';

async function buildWorkbookBuffer(
  cellValue: Date,
  numFmt = 'dd/mm/yyyy',
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Sheet1');
  sheet.addRow(['Beleg-Dat']);
  const dataRow = sheet.addRow([cellValue]);
  dataRow.getCell(1).numFmt = numFmt;
  return (await workbook.xlsx.writeBuffer()) as unknown as Buffer;
}

async function collectRows(
  buffer: Buffer,
  columns: FileImportColumn[],
): Promise<Record<string, any>[]> {
  const handler = new ExcelImportHandler();
  const rows: Record<string, any>[] = [];
  for await (const row of handler.streamRows(
    Readable.from(buffer),
    { firstRowAsHeaders: true },
    columns,
  )) {
    rows.push(row);
  }
  return rows;
}

describe('ExcelImportHandler', () => {
  it('imports a date-formatted xlsx cell into a Date column as an ISO date, not a raw serial number', async () => {
    const cellDate = new Date(Date.UTC(2026, 5, 15));
    const buffer = await buildWorkbookBuffer(cellDate);

    const columns: FileImportColumn[] = [
      { key: 0, title: 'Beleg-Dat', column_name: 'Beleg-Dat', uidt: UITypes.Date },
    ];

    const rows = await collectRows(buffer, columns);

    expect(rows).toHaveLength(1);
    const value = rows[0]['Beleg-Dat'];

    // Regression guard for nocodb/nocodb#14275: with `styles: 'ignore'` on the
    // workbook reader, exceljs never applies numFmt-based date detection, so
    // without the fix this cell surfaces as the raw Excel serial number
    // (e.g. 46188) instead of a date, which fails the DB insert.
    expect(typeof value).toBe('string');
    expect(Number.isNaN(Date.parse(value))).toBe(false);
    expect(new Date(value).toISOString().slice(0, 10)).toBe('2026-06-15');
  });

  it('leaves a plain numeric cell alone when the destination column is a Number', async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Sheet1');
    sheet.addRow(['Quantity']);
    sheet.addRow([42]);
    const buffer = (await workbook.xlsx.writeBuffer()) as unknown as Buffer;

    const columns: FileImportColumn[] = [
      { key: 0, title: 'Quantity', column_name: 'Quantity', uidt: UITypes.Number },
    ];

    const rows = await collectRows(buffer, columns);

    expect(rows[0]['Quantity']).toBe(42);
  });
});
