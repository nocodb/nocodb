import ExcelJS from 'exceljs';
import type { Readable } from 'stream';
import type { FileImportColumn, FileImportParserConfig } from 'nocodb-sdk';
import type {
  DataImportHandler,
  ImportPreviewResult,
  ImportRow,
} from '~/modules/jobs/jobs/data-import/handlers/data-import-handler.interface';
import { detectColumnTypesFromObjects } from '~/modules/jobs/jobs/data-import/csv-type-detector';

/**
 * Converts an ExcelJS cell value to a plain JS value.
 */
function resolveCellValue(cell: ExcelJS.Cell): any {
  const value = cell.value;
  if (value === null || value === undefined) return null;

  // ExcelJS returns rich text as { richText: [...] }
  if (typeof value === 'object' && 'richText' in value) {
    return (value as ExcelJS.CellRichTextValue).richText
      .map((rt) => rt.text)
      .join('');
  }

  // ExcelJS returns formulas as { formula, result }
  if (typeof value === 'object' && 'formula' in value) {
    return (value as ExcelJS.CellFormulaValue).result ?? null;
  }

  // ExcelJS returns hyperlinks as { text, hyperlink }
  if (typeof value === 'object' && 'hyperlink' in value) {
    return (value as ExcelJS.CellHyperlinkValue).text ?? null;
  }

  // ExcelJS returns errors as { error }
  if (typeof value === 'object' && 'error' in value) {
    return null;
  }

  // Date objects
  if (value instanceof Date) {
    return value.toISOString();
  }

  return value;
}

export class ExcelImportHandler implements DataImportHandler {
  async preview(
    readStream: Readable,
    parserConfig: FileImportParserConfig,
  ): Promise<ImportPreviewResult> {
    const { maxRowsToParse = 500, autoSelectFieldTypes = true } =
      parserConfig || {};

    const workbookReader = new ExcelJS.stream.xlsx.WorkbookReader(readStream, {
      entries: 'emit',
      sharedStrings: 'cache',
      styles: 'ignore',
      hyperlinks: 'ignore',
    });

    const sampleRows: Record<string, any>[] = [];
    let headers: string[] = [];
    let rowCount = 0;

    // Read only the first worksheet
    for await (const worksheetReader of workbookReader) {
      for await (const row of worksheetReader) {
        rowCount++;

        if (rowCount === 1 && parserConfig.firstRowAsHeaders !== false) {
          // First row is headers
          headers = [];
          row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
            const val = resolveCellValue(cell);
            headers[colNumber - 1] =
              val !== null ? String(val) : `Field ${colNumber}`;
          });

          // Fill gaps for any sparse header cells
          const maxCol = row.cellCount;
          for (let i = 0; i < maxCol; i++) {
            if (!headers[i]) headers[i] = `Field ${i + 1}`;
          }
          continue;
        }

        // Build row object only for sample rows
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
      // Only process the first worksheet
      break;
    }

    const totalRows =
      parserConfig.firstRowAsHeaders !== false ? rowCount - 1 : rowCount;

    if (!sampleRows.length) {
      return {
        columns: [],
        previewData: [],
        totalSampleRows: 0,
        totalRows: 0,
      };
    }

    const columns = detectColumnTypesFromObjects(headers, sampleRows, {
      maxRowsToParse,
      autoSelectFieldTypes,
    });

    return {
      columns,
      previewData: sampleRows.slice(0, 20),
      totalSampleRows: sampleRows.length,
      totalRows,
    };
  }

  async *streamRows(
    readStream: Readable,
    parserConfig: FileImportParserConfig,
    columns: FileImportColumn[],
  ): AsyncGenerator<ImportRow, void, undefined> {
    const colNameByIndex: Record<number, string> = {};
    for (const col of columns) {
      colNameByIndex[col.key] = col.column_name;
    }

    const workbookReader = new ExcelJS.stream.xlsx.WorkbookReader(readStream, {
      entries: 'emit',
      sharedStrings: 'cache',
      styles: 'ignore',
      hyperlinks: 'ignore',
    });

    let rowCount = 0;

    for await (const worksheetReader of workbookReader) {
      for await (const row of worksheetReader) {
        rowCount++;

        // Skip header row
        if (rowCount === 1 && parserConfig.firstRowAsHeaders !== false) {
          continue;
        }

        const record: ImportRow = {};
        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          const idx = colNumber - 1;
          const colName = colNameByIndex[idx];
          if (colName) {
            record[colName] = resolveCellValue(cell);
          }
        });

        yield record;
      }
      // Only process the first worksheet
      break;
    }
  }
}
