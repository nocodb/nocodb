import { Readable } from 'stream';
import ExcelJS from 'exceljs';
import type {
  FileImportColumn,
  FileImportParserConfig,
  ImportPreviewSheet,
} from 'nocodb-sdk';
import type {
  DataImportHandler,
  ImportRow,
} from '~/modules/jobs/jobs/data-import/handlers/data-import-handler.interface';
import { detectColumnTypesFromObjects } from '~/modules/jobs/jobs/data-import/csv-type-detector';
import {
  assertXlsxNotDecompressionBomb,
  readStreamToBuffer,
  readXlsxPart,
  repackXlsxForStreaming,
} from '~/modules/jobs/jobs/data-import/handlers/xlsx-bomb-guard';
import { NC_DATA_IMPORT_FILE_SIZE } from '~/constants';

// Buffer the upload (already capped upstream) so its decompressed sizes can be
// screened before exceljs caches sharedStrings into memory.
async function readGuardedWorkbook(readStream: Readable): Promise<Buffer> {
  const buf = await readStreamToBuffer(readStream, NC_DATA_IMPORT_FILE_SIZE);
  await assertXlsxNotDecompressionBomb(buf);
  return buf;
}

// styles are needed to tell a date cell from a number
const WORKBOOK_READER_OPTIONS = {
  entries: 'emit',
  sharedStrings: 'cache',
  styles: 'cache',
  hyperlinks: 'ignore',
} as const;

/** exceljs typings don't expose `name` on WorksheetReader, but the runtime does. */
type NamedWorksheetReader = ExcelJS.stream.xlsx.WorksheetReader & {
  name?: string;
};

/** exceljs typings don't declare that WorkbookReader is an EventEmitter. */
type EmittingWorkbookReader = ExcelJS.stream.xlsx.WorkbookReader & {
  on(
    event: 'entry',
    listener: (entry: { type: string; id?: string }) => void,
  ): void;
};

const XML_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
};

function decodeXml(v: string): string {
  return v.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e: string) => {
    if (e[0] !== '#') return XML_ENTITIES[e] ?? m;
    const code =
      e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : +e.slice(1);
    return String.fromCodePoint(code);
  });
}

function xmlElementAttrs(xml: string, tag: string): Record<string, string>[] {
  const elements = new RegExp(`<(?:[\\w.-]+:)?${tag}\\s([^>]*?)/?>`, 'g');
  return [...xml.matchAll(elements)].map(([, attrs]) =>
    Object.fromEntries(
      [...attrs.matchAll(/([\w.:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)].map(
        ([, k, dq, sq]) => [k, decodeXml(dq ?? sq)],
      ),
    ),
  );
}

/**
 * Sheet names keyed by worksheet part number (`xl/worksheets/sheet<n>.xml`).
 * exceljs only names a sheet when the workbook part is read before it and the
 * relationship target is relative, so others come out as "Sheet<n>".
 */
function readSheetNames(buf: Buffer): Map<string, string> {
  const names = new Map<string, string>();
  const workbook = readXlsxPart(buf, 'xl/workbook.xml');
  const rels = readXlsxPart(buf, 'xl/_rels/workbook.xml.rels');
  if (!workbook || !rels) return names;

  const targets = new Map<string, string>();
  for (const rel of xmlElementAttrs(rels, 'Relationship')) {
    if (!rel.Id || !rel.Target) continue;
    const target = rel.Target.startsWith('/')
      ? rel.Target.slice(1)
      : `xl/${rel.Target.replace(/^\.\//, '')}`;
    targets.set(rel.Id, target);
  }

  for (const sheet of xmlElementAttrs(workbook, 'sheet')) {
    const relId = Object.entries(sheet).find(([k]) => /:id$/.test(k))?.[1];
    const partNo = targets
      .get(relId)
      ?.match(/^xl\/worksheets\/sheet(\d+)\.xml$/)?.[1];
    if (partNo && sheet.name) names.set(partNo, sheet.name);
  }
  return names;
}

/** Whether the workbook counts dates from 1904 (old Mac Excel) instead of 1900. */
function readDate1904(buf: Buffer): boolean {
  const workbook = readXlsxPart(buf, 'xl/workbook.xml');
  const pr = workbook ? xmlElementAttrs(workbook, 'workbookPr')[0] : undefined;
  return pr?.date1904 === '1' || pr?.date1904 === 'true';
}

/** Worksheets of the workbook, each with its name from the workbook part. */
async function* readWorksheets(buf: Buffer): AsyncGenerator<{
  name: string;
  reader: NamedWorksheetReader;
  date1904: boolean;
}> {
  const names = readSheetNames(buf);
  const date1904 = readDate1904(buf);
  const workbookReader = new ExcelJS.stream.xlsx.WorkbookReader(
    Readable.from(repackXlsxForStreaming(buf)),
    WORKBOOK_READER_OPTIONS,
  ) as EmittingWorkbookReader;

  // exceljs announces the part number just before it yields that worksheet
  let partNo: string | undefined;
  workbookReader.on('entry', (entry) => {
    if (entry.type === 'worksheet') partNo = entry.id;
  });

  for await (const ws of workbookReader) {
    const reader = ws as NamedWorksheetReader;
    yield { name: names.get(partNo) ?? reader.name ?? '', reader, date1904 };
  }
}

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * A date cell as import text: `YYYY-MM-DD`, or `YYYY-MM-DD HH:mm:ss` when it
 * has a time. exceljs reads the cell's wall-clock time as UTC.
 */
export function formatExcelDate(d: Date): string {
  const date = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(
    d.getUTCDate(),
  )}`;
  if (!d.getUTCHours() && !d.getUTCMinutes() && !d.getUTCSeconds()) {
    return date;
  }
  return `${date} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(
    d.getUTCSeconds(),
  )}`;
}

/**
 * A date only when the format has a year or day part: time-only and duration
 * formats (`h:mm AM/PM`, `[h]:mm`) keep the raw number.
 */
function isDateFormat(fmt: string | undefined): boolean {
  if (!fmt) return false;
  return /[yd]/i.test(
    fmt
      .replace(/\[[^\]]*]/g, '')
      .replace(/"[^"]*"/g, '')
      .replace(/[\\_*]./g, ''),
  );
}

// Days from the 1900 system's epoch to 1970-01-01, as exceljs counts them.
const epochDays = (date1904: boolean) => 25569 - (date1904 ? 1462 : 0);

const excelSerialToDate = (serial: number, date1904: boolean) =>
  new Date(Math.round((serial - epochDays(date1904)) * 86400000));

/** The serial exceljs read a cell's Date from: the shortest that rounds back. */
function excelDateToSerial(d: Date, date1904: boolean): number {
  const ms = d.getTime();
  const exact = ms / 86400000 + epochDays(date1904);
  for (let digits = 1; digits <= 17; digits++) {
    const serial = +exact.toPrecision(digits);
    if (excelSerialToDate(serial, date1904).getTime() === ms) return serial;
  }
  return exact;
}

const validDate = (d: Date) => (isNaN(d.getTime()) ? null : d);

/**
 * A cell's value. Date cells come back as `Date` (wall-clock time as UTC), so
 * the import can store them as UTC; preview shows them with `formatExcelDate`.
 */
function resolveCellValue(cell: ExcelJS.Cell, date1904: boolean): any {
  const value = cell.value;
  if (value === null || value === undefined) return null;

  if (typeof value === 'object' && 'richText' in value) {
    return (value as ExcelJS.CellRichTextValue).richText
      .map((rt) => rt.text)
      .join('');
  }
  if (typeof value === 'object' && 'formula' in value) {
    // the stream reader leaves a formula's result as the raw serial number
    const result = (value as ExcelJS.CellFormulaValue).result;
    if (typeof result === 'number') {
      if (isNaN(result)) return null; // error result
      return isDateFormat(cell.numFmt)
        ? validDate(excelSerialToDate(result, date1904))
        : result;
    }
    if (result instanceof Date) return validDate(result);
    if (result && typeof result === 'object') return null; // error result
    return result ?? null;
  }
  if (typeof value === 'object' && 'hyperlink' in value) {
    return (value as ExcelJS.CellHyperlinkValue).text ?? null;
  }
  if (typeof value === 'object' && 'error' in value) {
    return null;
  }
  if (value instanceof Date) {
    if (!validDate(value)) return null;
    // exceljs also reads time-only formats as dates
    return isDateFormat(cell.numFmt)
      ? value
      : excelDateToSerial(value, date1904);
  }
  return value;
}

const previewValue = (v: unknown) =>
  v instanceof Date ? formatExcelDate(v) : v;

export class ExcelImportHandler implements DataImportHandler {
  async preview(
    readStream: Readable,
    parserConfig: FileImportParserConfig,
  ): Promise<ImportPreviewSheet[]> {
    const { maxRowsToParse = 500, autoSelectFieldTypes = true } =
      parserConfig || {};
    const firstRowAsHeaders = parserConfig.firstRowAsHeaders !== false;

    const buf = await readGuardedWorkbook(readStream);
    const sheets: ImportPreviewSheet[] = [];

    for await (const { name, reader, date1904 } of readWorksheets(buf)) {
      sheets.push(
        await this.readSheetPreview(
          name,
          reader,
          date1904,
          firstRowAsHeaders,
          maxRowsToParse,
          autoSelectFieldTypes,
        ),
      );
    }

    return sheets;
  }

  private async readSheetPreview(
    name: string,
    worksheetReader: NamedWorksheetReader,
    date1904: boolean,
    firstRowAsHeaders: boolean,
    maxRowsToParse: number,
    autoSelectFieldTypes: boolean,
  ): Promise<ImportPreviewSheet> {
    // rows by column index, so columns sharing a header stay apart
    const sampleRows: unknown[][] = [];
    let headers: string[] = [];
    let rowCount = 0;

    for await (const row of worksheetReader) {
      rowCount++;

      if (rowCount === 1 && firstRowAsHeaders) {
        headers = [];
        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          const val = previewValue(resolveCellValue(cell, date1904));
          headers[colNumber - 1] =
            val !== null ? String(val) : `Field ${colNumber}`;
        });
        const maxCol = row.cellCount;
        for (let i = 0; i < maxCol; i++) {
          if (!headers[i]) headers[i] = `Field ${i + 1}`;
        }
        continue;
      }

      if (sampleRows.length >= maxRowsToParse) continue;

      const values: unknown[] = [];
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        const idx = colNumber - 1;
        if (!headers[idx]) headers[idx] = `Field ${colNumber}`;
        values[idx] = previewValue(resolveCellValue(cell, date1904));
      });
      sampleRows.push(values);
    }

    for (let i = 0; i < headers.length; i++) {
      headers[i] ??= `Field ${i + 1}`;
    }

    const totalRows = firstRowAsHeaders ? rowCount - 1 : rowCount;
    const columns = sampleRows.length
      ? detectColumnTypesFromObjects(headers, [], {
          maxRowsToParse,
          autoSelectFieldTypes,
        })
      : [];

    const previewData = sampleRows
      .slice(0, 20)
      .map((values) =>
        Object.fromEntries(
          columns.map((col) => [col.column_name, values[col.key] ?? null]),
        ),
      );

    return {
      name,
      columns,
      previewData,
      totalSampleRows: sampleRows.length,
      totalRows: Math.max(totalRows, 0),
    };
  }

  async *streamRows(
    readStream: Readable,
    parserConfig: FileImportParserConfig,
    columns: FileImportColumn[],
    sheetName?: string,
  ): AsyncGenerator<ImportRow, void, undefined> {
    const firstRowAsHeaders = parserConfig.firstRowAsHeaders !== false;

    const colNameByIndex: Record<number, string> = {};
    for (const col of columns) {
      colNameByIndex[col.key] = col.column_name;
    }

    const buf = await readGuardedWorkbook(readStream);

    for await (const { name, reader: ws, date1904 } of readWorksheets(buf)) {
      // Drain non-target sheets so exceljs doesn't stall the stream.
      if (sheetName && name !== sheetName) {
        for await (const _row of ws) {
          // drain
        }
        continue;
      }

      let rowCount = 0;
      for await (const row of ws) {
        rowCount++;
        if (rowCount === 1 && firstRowAsHeaders) continue;

        const record: ImportRow = {};
        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          const colName = colNameByIndex[colNumber - 1];
          if (colName) record[colName] = resolveCellValue(cell, date1904);
        });
        yield record;
      }

      if (sheetName) return;
    }
  }
}
