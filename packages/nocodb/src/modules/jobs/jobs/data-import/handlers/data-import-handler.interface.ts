import type { Readable } from 'stream';
import type { FileImportColumn, FileImportParserConfig } from 'nocodb-sdk';
import type { DetectedColumn } from '~/modules/jobs/jobs/data-import/csv-type-detector';

export type ImportRow = Record<string, any>;

export interface ImportPreviewResult {
  columns: DetectedColumn[];
  previewData: Record<string, any>[];
  totalSampleRows: number;
  detectedDelimiter?: string;
}

export interface DataImportHandler {
  preview(
    readStream: Readable,
    parserConfig: FileImportParserConfig,
  ): Promise<ImportPreviewResult>;

  streamRows(
    readStream: Readable,
    parserConfig: FileImportParserConfig,
    columns: FileImportColumn[],
  ): AsyncGenerator<ImportRow, void, undefined>;
}
