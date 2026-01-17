import type { NcApiVersion, UITypes } from 'nocodb-sdk';
import type { Knex, XKnex } from '~/db/CustomKnex';
import type { DBQueryClient as DBQueryClientCE } from 'src/dbQueryClient/types';
import type { Column, Model } from '~/models';
import type { IBaseModelSqlV2 } from '~/db/IBaseModelSqlV2';

export interface ExtractColumnParam {
  column: Column;
  qb: Knex.QueryBuilder;
  rootAlias: string;
  knex: XKnex;
  isLookup?: boolean;
  params?: any;
  getAlias: () => string;
  baseModel: IBaseModelSqlV2;
  // dependencyFields: DependantFields;
  ast: Record<string, any>;
  throwErrorIfInvalidParams: boolean;
  validateFormula: boolean;
  columns?: Column[];
  apiVersion: NcApiVersion;
  model: Model;
  aliasToColumn: any;
  columnIdToUidt: Record<string, UITypes>;
  baseUsers: any;
}

export interface ExtractColumnFunc {
  (param: ExtractColumnParam): Promise<any>;
}

export interface ExtractColumnsParam {
  columns: Column[];
  // allowedCols?: Record<string, boolean>;
  knex: XKnex;
  qb;
  getAlias: () => string;
  params: any;
  alias?: string;
  baseModel: IBaseModelSqlV2;
  // dependencyFields: DependantFields;
  ast: Record<string, any> | boolean | 0 | 1;
  throwErrorIfInvalidParams: boolean;
  validateFormula: boolean;
  apiVersion: NcApiVersion;
}

export interface ExtractColumnsFunc {
  (param: ExtractColumnsParam): Promise<any>;
}

export interface DBQueryClient extends DBQueryClientCE {
  extractColumns: ExtractColumnsFunc;
  extractColumn: ExtractColumnFunc;

  generateNestedRowSelectQuery(param: {
    knex: XKnex;
    alias: string;
    title: string;
    columns: Column[];
    isBtOrOo?: boolean;
  }): any;
}
