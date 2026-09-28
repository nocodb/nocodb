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

/** Per-column settings used when the destination is a link (LTAR) field. */
export interface FileImportLinkConfig {
  /** Delimiter separating multiple display values within one cell. Default ','. */
  delimiter?: string;
}

/** Maps a source column name to a destination column on an existing table. */
export interface FileImportColumnMapping {
  sourceCn: string;
  destCn: string;
  enabled: boolean;
  /** Set when `destCn` resolves to a link (LTAR) column. */
  linkConfig?: FileImportLinkConfig;
  /**
   * When true, create a new column on the existing table (named `destCn`)
   * from the source column's definition instead of mapping to an existing one.
   */
  createColumn?: boolean;
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

/**
 * Airtable import migration report — returned as the AtImport job result so the
 * import dialog can summarise what did not come across and offer it for download.
 */
export enum AirtableImportIssueKind {
  /** Not imported at all. */
  SKIPPED = 'skipped',
  /** Imported, but with different semantics from the Airtable original. */
  APPROXIMATED = 'approximated',
  /** Import was attempted and the server rejected it. */
  FAILED = 'failed',
}

export enum AirtableImportIssueCategory {
  TABLE = 'table',
  COLUMN = 'column',
  SELECT_OPTION = 'select_option',
  LINK = 'link',
  LOOKUP = 'lookup',
  ROLLUP = 'rollup',
  DISPLAY_VALUE = 'display_value',
  VIEW = 'view',
  FIELD_VISIBILITY = 'field_visibility',
  FILTER = 'filter',
  SORT = 'sort',
  GROUP = 'group',
  DATA = 'data',
}

export interface AirtableImportIssue {
  kind: AirtableImportIssueKind;
  category: AirtableImportIssueCategory;
  table?: string;
  view?: string;
  field?: string;
  /** Airtable field type, when the issue concerns a field. */
  airtable_type?: string;
  reason: string;
}

export interface AirtableImportReport {
  version: 1;
  summary: {
    tables: number;
    columns: number;
    views: number;
    filters: number;
    sorts: number;
    records: number;
    nested_links: number;
    duration_ms: number;
  };
  counts: Record<AirtableImportIssueKind, number>;
  by_category: Partial<Record<AirtableImportIssueCategory, number>>;
  issues: AirtableImportIssue[];
  /**
   * Issues left out of `issues` to keep the report storable; `counts` and
   * `by_category` still cover them, and every issue is in the job log.
   */
  truncated?: number;
}
