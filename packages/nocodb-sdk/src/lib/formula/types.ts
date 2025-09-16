import { SqlUiFactory } from '../sqlUi';
import UITypes from '../UITypes';
import { FormulaDataTypes } from './enums';
export interface ReferencedInfo {
  referencedColumn?: { id: string; uidt: string };
  invalidForReferenceColumn?: boolean;
  uidtCandidates?: UITypes[];
}

export interface FormulaMeta {
  validation?: {
    args?: {
      min?: number;
      max?: number;
      rqd?: number;

      // array of allowed types when args types are not same
      // types should be in order of args
      type?: FormulaDataTypes | FormulaDataTypes[];
    };
    custom?: (args: FormulaDataTypes[], parseTree: any) => void;
  };
  description?: string;
  syntax?: string;
  examples?: string[];
  returnType?: ((args: any[]) => FormulaDataTypes) | FormulaDataTypes;
  docsUrl?: string;
}
export type SqlUI = ReturnType<(typeof SqlUiFactory)['create']>;
export type ClientTypeOrSqlUI =
  | 'mysql'
  | 'pg'
  | 'sqlite3'
  | 'mysql2'
  | 'oracledb'
  | 'mariadb'
  | 'sqlite'
  | 'snowflake'
  | SqlUI;
