import { parse } from 'papaparse';
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
import { AsyncQueue } from '~/modules/jobs/jobs/data-import/handlers/async-queue';
import { detectColumnTypes } from '~/modules/jobs/jobs/data-import/csv-type-detector';

export class CsvImportHandler implements DataImportHandler {
  async preview(
    readStream: Readable,
    parserConfig: FileImportParserConfig,
  ): Promise<ImportPreviewSheet[]> {
    const {
      firstRowAsHeaders = true,
      delimiter,
      maxRowsToParse = 500,
      autoSelectFieldTypes = true,
    } = parserConfig || {};

    const headers: string[] = [];
    const sampleRows: string[][] = [];
    let rowCount = 0;
    let detectedDelimiter: string | undefined;

    await new Promise<void>((resolve, reject) => {
      parse(readStream, {
        delimiter: delimiter || undefined,
        skipEmptyLines: 'greedy',
        step(row: { data: string[]; meta?: { delimiter?: string } }) {
          rowCount++;

          if (!detectedDelimiter && row.meta?.delimiter) {
            detectedDelimiter = row.meta.delimiter;
          }

          if (rowCount === 1 && firstRowAsHeaders) {
            headers.push(...row.data);
          } else {
            if (rowCount === 1) {
              for (let i = 0; i < row.data.length; i++) {
                headers.push(`Field ${i + 1}`);
              }
            }
            if (sampleRows.length < maxRowsToParse) {
              sampleRows.push(row.data);
            }
          }
        },
        complete() {
          resolve();
        },
        error(err) {
          reject(err);
        },
      });
    });

    const totalRows = firstRowAsHeaders ? rowCount - 1 : rowCount;

    if (!headers.length) {
      return [
        {
          columns: [],
          previewData: [],
          totalSampleRows: 0,
          totalRows: 0,
          detectedDelimiter: delimiter || ',',
        },
      ];
    }

    const columns = detectColumnTypes(headers, sampleRows, {
      maxRowsToParse,
      autoSelectFieldTypes,
    });

    const previewRows = sampleRows.slice(0, 20).map((row) => {
      const rowObj: Record<string, any> = {};
      for (let i = 0; i < columns.length; i++) {
        rowObj[columns[i].column_name] = row[i] ?? null;
      }
      return rowObj;
    });

    return [
      {
        columns,
        previewData: previewRows,
        totalSampleRows: sampleRows.length,
        totalRows,
        detectedDelimiter: detectedDelimiter || delimiter || ',',
      },
    ];
  }

  async *streamRows(
    readStream: Readable,
    parserConfig: FileImportParserConfig,
    columns: FileImportColumn[],
  ): AsyncGenerator<ImportRow, void, undefined> {
    const { firstRowAsHeaders = true, delimiter } = parserConfig || {};

    const colNameByKey: Record<number, string> = {};
    for (const col of columns) {
      colNameByKey[col.key] = col.column_name;
    }

    const queue = new AsyncQueue<ImportRow>();
    let headerSkipped = false;

    parse(readStream, {
      delimiter: delimiter || undefined,
      skipEmptyLines: 'greedy',
      step(row: { data: string[] }, parser) {
        if (!headerSkipped && firstRowAsHeaders) {
          headerSkipped = true;
          return;
        }

        parser.pause();

        const record: ImportRow = {};
        const data = row.data;
        for (const [keyStr, colName] of Object.entries(colNameByKey)) {
          record[colName] = data[parseInt(keyStr, 10)] ?? null;
        }

        queue.push(record, () => parser.resume());
      },
      complete() {
        queue.end();
      },
      error(err) {
        queue.error(err);
      },
    });

    yield* queue;
  }
}
