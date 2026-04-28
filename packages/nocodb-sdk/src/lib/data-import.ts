import type UITypes from '~/lib/UITypes';

export type FileImportType = 'csv' | 'json' | 'excel';

/** Column from a parsed source file, produced by preview, consumed by import. */
export interface FileImportColumn {
  title: string;
  column_name: string;
  uidt: UITypes | string;
  key: number;
  meta?: Record<string, any>;
  dtxp?: string;
  path?: string[];
}

/** How to parse the source file. No import-decision flags here. */
export interface FileImportParserConfig {
  firstRowAsHeaders: boolean;
  delimiter?: string;
  encoding?: string;
  maxRowsToParse?: number;
  autoSelectFieldTypes?: boolean;
  normalizeNested?: boolean;
}

/** What to do with the parsed rows. No parser settings here. */
export interface FileImportOptions {
  /** Insert rows. When false, only the schema is created. */
  shouldImportData: boolean;
  /** Import into an existing table instead of creating a new one. */
  importDataOnly: boolean;
  typecast?: boolean;
}

/** Maps a source column name to a destination column on an existing table. */
export interface FileImportColumnMapping {
  sourceCn: string;
  destCn: string;
  enabled: boolean;
}

/**
 * One import target. CSV/JSON jobs carry exactly one of these; an Excel job
 * carries one per sheet in the workbook.
 */
export interface FileImportSheet {
  /** Workbook sheet name. Only set for Excel. */
  sheetName?: string;
  /** New table name — required when creating a table (`importDataOnly=false`). */
  tableName?: string;
  /** Target table id — required when importing into an existing table. */
  tableId?: string;
  columns: FileImportColumn[];
  /** Required when `importDataOnly=true`. */
  columnMapping?: FileImportColumnMapping[];
}

/** One sheet of a preview response. CSV/JSON return a single-element array. */
export interface ImportPreviewSheet {
  /** Sheet name. Empty string / undefined for single-sheet formats. */
  name?: string;
  columns: FileImportColumn[];
  previewData: Record<string, any>[];
  totalSampleRows: number;
  /** Total row count in the sheet. -1 if unknown. */
  totalRows: number;
  /** Delimiter detected for CSV. */
  detectedDelimiter?: string;
}

export interface ImportPreviewResponse {
  sheets: ImportPreviewSheet[];
}
