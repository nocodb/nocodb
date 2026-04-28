import type { Readable } from 'stream';
import type {
  FileImportColumn,
  FileImportParserConfig,
  ImportPreviewSheet,
} from 'nocodb-sdk';

export type ImportRow = Record<string, any>;

/**
 * A file handler parses a single uploaded file. CSV/JSON produce exactly one
 * sheet per file; Excel produces one per worksheet in the workbook.
 */
export interface DataImportHandler {
  /** Parse the file and return one entry per logical sheet. */
  preview(
    readStream: Readable,
    parserConfig: FileImportParserConfig,
  ): Promise<ImportPreviewSheet[]>;

  /**
   * Stream rows for a single sheet. `sheetName` is only meaningful for Excel;
   * other handlers ignore it.
   */
  streamRows(
    readStream: Readable,
    parserConfig: FileImportParserConfig,
    columns: FileImportColumn[],
    sheetName?: string,
  ): AsyncGenerator<ImportRow, void, undefined>;
}
