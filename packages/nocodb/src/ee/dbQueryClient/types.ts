import type { NcApiVersion, UITypes } from 'nocodb-sdk';
import type { DBQueryClient as DBQueryClientCE } from 'src/dbQueryClient/types';
import type { Knex, XKnex } from '~/db/CustomKnex';
import type { IBaseModelSqlV2 } from '~/db/IBaseModelSqlV2';
import type { Column, Model } from '~/models';
import type { NcContext } from '~/interface/config';
import type { Source, View } from '~/models';
import type { Filter } from '~/models';
import type { PagedResponseImpl } from '~/helpers/PagedResponse';

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
  (param: ExtractColumnParam): Promise<{
    isArray?: boolean;
  }>;
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
  (param: ExtractColumnsParam): Promise<void>;
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

  singleQueryList(
    context: NcContext,
    ctx: {
      model: Model;
      view?: View;
      source: Source;
      params;
      throwErrorIfInvalidParams?: boolean;
      validateFormula?: boolean;
      ignorePagination?: boolean;
      limitOverride?: number;
      baseModel?: IBaseModelSqlV2;
      customConditions?: Filter[];
      getHiddenColumns?: boolean;
      apiVersion?: NcApiVersion;
      includeSortAndFilterColumns?: boolean;
      skipPaginateWrapper?: boolean;
      skipSortBasedOnOrderCol?: boolean;
      ignoreViewFilterAndSort?: boolean;
      ignoreRls?: boolean;
    },
  ): Promise<
    PagedResponseImpl<Record<string, any>> | Array<Record<string, any>>
  >;

  singleQueryRead(
    context: NcContext,
    ctx: {
      model: Model;
      view: View;
      source: Source;
      params;
      id: string | Record<string, any>;
      getHiddenColumn?: boolean;
      throwErrorIfInvalidParams?: boolean;
      validateFormula?: boolean;
      apiVersion?: NcApiVersion;
      extractOnlyPrimaries?: boolean;
      extractOrderColumn?: boolean;
      ignoreRls?: boolean;
    },
  ): Promise<Record<string, any>>;
}
