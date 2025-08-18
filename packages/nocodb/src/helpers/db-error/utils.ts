export type DBErrorExtractResult =
  | {
      message: string;
      error: string;
      details?: any;
      code?: string;
      httpStatus: number;
    }
  | undefined;
export interface IClientDbErrorExtractor {
  extract(error: any): DBErrorExtractResult;
}

export enum DBError {
  TABLE_EXIST = 'TABLE_EXIST',
  TABLE_NOT_EXIST = 'TABLE_NOT_EXIST',
  COLUMN_EXIST = 'COLUMN_EXIST',
  COLUMN_NOT_EXIST = 'COLUMN_NOT_EXIST',
  CONSTRAINT_EXIST = 'CONSTRAINT_EXIST',
  CONSTRAINT_NOT_EXIST = 'CONSTRAINT_NOT_EXIST',
  COLUMN_NOT_NULL = 'COLUMN_NOT_NULL',
  DATA_TYPE_MISMATCH = 'DATA_TYPE_MISMATCH',
}
