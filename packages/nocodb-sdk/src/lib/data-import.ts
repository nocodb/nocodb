import type UITypes from '~/lib/UITypes';

export type FileImportType = 'csv';

export interface FileImportColumn {
  title: string;
  column_name: string;
  uidt: UITypes | string;
  key: number;
  meta?: Record<string, any>;
  dtxp?: string;
  path?: string[];
}

export interface FileImportParserConfig {
  firstRowAsHeaders: boolean;
  delimiter?: string;
  encoding?: string;
  maxRowsToParse?: number;
  autoSelectFieldTypes?: boolean;
  normalizeNested?: boolean;
}

export interface FileImportOptions {
  shouldImportData: boolean;
  importDataOnly: boolean;
  typecast?: boolean;
}

export interface FileImportColumnMapping {
  sourceCn: string;
  destCn: string;
  enabled: boolean;
}
