import type CustomKnex from '../CustomKnex';
import type { Logger } from '@nestjs/common';
import type { IBaseModelSqlV2 } from '../IBaseModelSqlV2';
import type { MetaService } from 'src/meta/meta.service';
import type { FilterType, NcContext } from 'nocodb-sdk';
import type { Knex } from 'knex';
import type { Column, Filter } from '~/models';

export interface ConditionParser {
  (
    baseModelSqlv2: IBaseModelSqlV2,
    _filter: Filter | FilterType | FilterType[] | Filter[],
    aliasCount: { count: number },
    alias?: string,
    customWhereClause?: string,
    throwErrorIfInvalid?: boolean,
  ): Promise<FilterOperationResult>;
}

export interface FilterOptions {
  alias?: string;
  throwErrorIfInvalid?: boolean; // required by formula and lookup
  context?: NcContext;
  baseModel?: IBaseModelSqlV2; // required by formula and lookup
  metaService?: MetaService;
  knex?: Knex;
  tnPath?: string;
  fieldHandler?: IFieldHandler;
  depth?: { count: number }; // required by formula and lookup for alias
  customWhereClause?: Knex.QueryBuilder | string; // used by rollup and formula since their source is computed
  conditionParser?: ConditionParser; // backward compatibility aimed to conditionV2.parseConditionV2
}

export type FilterOperationResult = {
  clause: (qb: Knex.QueryBuilder) => void;
  rootApply?: (qb: Knex.QueryBuilder) => void;
};

export interface FilterOperation {
  (
    args: {
      sourceField: string | Knex.QueryBuilder | Knex.RawBuilder | Knex.Raw;
      val: any;
    },
    rootArgs: {
      knex: CustomKnex;
      filter: Filter;
      column: Column;
    },
    options: FilterOptions,
  ): Promise<FilterOperationResult>;
}

export interface FilterOperationHandlers {
  filterEq: FilterOperation;
  filterNeq: FilterOperation;
  filterNot: FilterOperation;
  filterLike: FilterOperation;
  filterNlike: FilterOperation;
  filterBlank: FilterOperation;
  filterNotblank: FilterOperation;
  /**
   * `null` / `notnull` — match strictly on `IS NULL` / `IS NOT NULL`. Distinct
   * from `blank` / `notblank`, which also fold empty-string `''` into the
   * predicate. Splitting these out preserves the pre-FieldHandler semantics
   * that the legacy conditionV2 path still keeps for SingleLineText/Email/etc.
   * Collapsing all three into `filterBlank` made `null`/`empty`/`blank`
   * behave identically and broke the filter parity tests for LongText /
   * SingleSelect / MultiSelect on PG.
   */
  filterNull: FilterOperation;
  filterNotnull: FilterOperation;
  /**
   * `empty` / `notempty` — match strictly on `= ''` / `<> '' OR IS NULL`.
   * Distinct from `blank` / `notblank` (see above).
   */
  filterEmpty: FilterOperation;
  filterNotempty: FilterOperation;
  filterIs: FilterOperation;
  filterIsnot: FilterOperation;
  filterGt: FilterOperation;
  filterGte: FilterOperation;
  filterLt: FilterOperation;
  filterLte: FilterOperation;
  filterChecked: FilterOperation;
  filterNotchecked: FilterOperation;
  filterAllof: FilterOperation;
  filterNallof: FilterOperation;
  filterAnyof: FilterOperation;
  filterNanyof: FilterOperation;
  filterIn: FilterOperation;
}

export interface FilterVerificationResult {
  isValid: boolean;
  errors?: string[];
}

export interface SortOptions {
  alias?: string;
  /** 'FIRST' or 'LAST' — controls SQL NULLS positioning. */
  nulls?: 'FIRST' | 'LAST';
  context?: NcContext;
  knex?: Knex;
  baseModel?: IBaseModelSqlV2;
}
export interface FieldHandlerInterface {
  select(qb: Knex.QueryBuilder, column: Column, options: FilterOptions): void;
  filter(
    knex: Knex,
    filter: Filter,
    column: Column,
    options?: FilterOptions,
  ): Promise<FilterOperationResult>;
  /**
   * Apply ORDER BY for a column. Each column type owns its sort expression
   * — text columns sort the raw column, User columns sort by display name,
   * Formula columns sort by compiled SQL, etc.
   */
  applySort(
    qb: Knex.QueryBuilder,
    column: Column,
    direction: 'asc' | 'desc',
    options?: SortOptions,
  ): Promise<void>;
  verifyFilter(
    filter: Filter,
    column: Column,
    options?: FilterOptions,
  ): Promise<FilterVerificationResult>;

  parseUserInput(params: {
    value: any;
    row: any;
    column: Column;
    options?: {
      context?: NcContext;
      metaService?: MetaService;
      logger?: Logger;
      baseModel?: IBaseModelSqlV2;
    };
    // for now the return value need to be {value: any}
    // since it's possible for it to be knex query, which
    // can be executed when awaited
  }): Promise<{ value: any }>;

  parseDbValue(params: {
    value: any;
    row: any;
    column: Column;
    options?: {
      context?: NcContext;
      metaService?: MetaService;
      logger?: Logger;
      baseModel?: IBaseModelSqlV2;
      fieldHandler?: IFieldHandler;
    };
    // for now the return value need to be {value: any}
    // since it's possible for it to be knex query, which
    // can be executed when awaited
  }): Promise<{ value: any }>;
}

export interface IFieldHandler {
  applyFilter(
    filter: Filter,
    column?: Column,
    options?: FilterOptions,
  ): Promise<FilterOperationResult>;

  applyFilters(
    filters: Filter[],
    options?: FilterOptions,
  ): Promise<FilterOperationResult>;

  applySelect(
    qb: Knex.QueryBuilder,
    column: Column,
    options?: FilterOptions,
  ): Promise<void>;

  applySort(
    qb: Knex.QueryBuilder,
    column: Column,
    direction: 'asc' | 'desc',
    options?: SortOptions,
  ): Promise<void>;

  verifyFilter(
    filter: Filter,
    column: Column,
    options?: FilterOptions,
  ): Promise<FilterVerificationResult>;

  verifyFiltersSafe(
    filters: Filter[],
    options?: FilterOptions,
  ): Promise<FilterVerificationResult>;

  verifyFilters(filters: Filter[], options?: FilterOptions): Promise<boolean>;

  parseUserInput(params: {
    value: any;
    row: any;
    oldData?: any;
    column: Column;
    options?: {
      context?: NcContext;
      metaService?: MetaService;
      baseModel?: IBaseModelSqlV2;
      logger?: Logger;
    };
  }): Promise<{ value: any }>;

  parseDbValue(params: {
    value: any;
    row: any;
    column: Column;
    options?: {
      context?: NcContext;
      metaService?: MetaService;
      baseModel?: IBaseModelSqlV2;
      logger?: Logger;
    };
    // for now the return value need to be {value: any}
    // since it's possible for it to be knex query, which
    // can be executed when awaited
  }): Promise<{ value: any }>;

  parseDataDbValue(params: {
    data: any | any[];
    options?: {
      additionalColumns?: Column[];
      baseModel?: IBaseModelSqlV2;
      context?: NcContext;
      metaService?: MetaService;
      logger?: Logger;
    };
    // for now the return value need to be {value: any}
    // since it's possible for it to be knex query, which
    // can be executed when awaited
  }): Promise<void>;
}
