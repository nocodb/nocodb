import ExcelJS from 'exceljs';
import type { Readable } from 'stream';
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

const WORKBOOK_READER_OPTIONS = {
  entries: 'emit',
  sharedStrings: 'cache',
  styles: 'ignore',
  hyperlinks: 'ignore',
} as const;

/** exceljs typings don't expose `name` on WorksheetReader, but the runtime does. */
type NamedWorksheetReader = ExcelJS.stream.xlsx.WorksheetReader & {
  name?: string;
};

function resolveCellValue(cell: ExcelJS.Cell): any {
  const value = cell.value;
  if (value === null || value === undefined) return null;

  if (typeof value === 'object' && 'richText' in value) {
    return (value as ExcelJS.CellRichTextValue).richText
      .map((rt) => rt.text)
      .join('');
  }
  if (typeof value === 'object' && 'formula' in value) {
    return (value as ExcelJS.CellFormulaValue).result ?? null;
  }
  if (typeof value === 'object' && 'hyperlink' in value) {
    return (value as ExcelJS.CellHyperlinkValue).text ?? null;
  }
  if (typeof value === 'object' && 'error' in value) {
    return null;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return value;
}

export class ExcelImportHandler implements DataImportHandler {
  async preview(
    readStream: Readable,
    parserConfig: FileImportParserConfig,
  ): Promise<ImportPreviewSheet[]> {
    const { maxRowsToParse = 500, autoSelectFieldTypes = true } =
      parserConfig || {};
    const firstRowAsHeaders = parserConfig.firstRowAsHeaders !== false;

    const workbookReader = new ExcelJS.stream.xlsx.WorkbookReader(
      readStream,
      WORKBOOK_READER_OPTIONS,
    );

    const sheets: ImportPreviewSheet[] = [];

    for await (const worksheetReader of workbookReader) {
      sheets.push(
        await this.readSheetPreview(
          worksheetReader as NamedWorksheetReader,
          firstRowAsHeaders,
          maxRowsToParse,
          autoSelectFieldTypes,
        ),
      );
    }

    return sheets;
  }

  private async readSheetPreview(
    worksheetReader: NamedWorksheetReader,
    firstRowAsHeaders: boolean,
    maxRowsToParse: number,
    autoSelectFieldTypes: boolean,
  ): Promise<ImportPreviewSheet> {
    const sampleRows: Record<string, any>[] = [];
    let headers: string[] = [];
    let rowCount = 0;

    for await (const row of worksheetReader) {
      rowCount++;

      if (rowCount === 1 && firstRowAsHeaders) {
        headers = [];
        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          const val = resolveCellValue(cell);
          headers[colNumber - 1] =
            val !== null ? String(val) : `Field ${colNumber}`;
        });
        const maxCol = row.cellCount;
        for (let i = 0; i < maxCol; i++) {
          if (!headers[i]) headers[i] = `Field ${i + 1}`;
        }
        continue;
      }

      if (sampleRows.length < maxRowsToParse) {
        const rowObj: Record<string, any> = {};
        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          const idx = colNumber - 1;
          const colName = headers[idx] || `Field ${colNumber}`;
          if (!headers[idx]) headers[idx] = colName;
          rowObj[colName] = resolveCellValue(cell);
        });
        sampleRows.push(rowObj);
      }
    }

    const totalRows = firstRowAsHeaders ? rowCount - 1 : rowCount;
    const columns = sampleRows.length
      ? detectColumnTypesFromObjects(headers, sampleRows, {
          maxRowsToParse,
          autoSelectFieldTypes,
        })
      : [];

    return {
      name: worksheetReader.name ?? '',
      columns,
      previewData: sampleRows.slice(0, 20),
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

    const workbookReader = new ExcelJS.stream.xlsx.WorkbookReader(
      readStream,
      WORKBOOK_READER_OPTIONS,
    );

    for await (const reader of workbookReader) {
      const ws = reader as NamedWorksheetReader;

      // Drain non-target sheets so exceljs doesn't stall the stream.
      if (sheetName && ws.name !== sheetName) {
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
          if (colName) record[colName] = resolveCellValue(cell);
        });
        yield record;
      }

      if (sheetName) return;
    }
  }
}
