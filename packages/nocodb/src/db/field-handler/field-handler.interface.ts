import type CustomKnex from '../CustomKnex';
import type { Logger } from '@nestjs/common';
import type { IBaseModelSqlV2 } from '../IBaseModelSqlV2';
import type { MetaService } from 'src/meta/meta.service';
import type { FilterType, NcContext } from 'nocodb-sdk';
import type { Knex } from 'knex';
import type { Column, Filter } from '~/models';

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
  conditionParser?: (
    baseModelSqlv2: IBaseModelSqlV2,
    _filter: Filter | FilterType | FilterType[] | Filter[],
    aliasCount: { count: number },
    alias?: string,
    customWhereClause?: string,
    throwErrorIfInvalid?: boolean,
  ) => Promise<(qbP: Knex.QueryBuilder) => void>; // backward compatibility aimed to conditionV2.parseConditionV2
}

export interface FilterOperation {
  (
    args: {
      sourceField: string | Knex.QueryBuilder | Knex.RawBuilder;
      val: any;
    },
    rootArgs: {
      knex: CustomKnex;
      filter: Filter;
      column: Column;
    },
    options: FilterOptions,
  ): Promise<(qb: Knex.QueryBuilder) => void>;
}

export interface FilterOperationHandlers {
  filterEq: FilterOperation;
  filterNeq: FilterOperation;
  filterNot: FilterOperation;
  filterLike: FilterOperation;
  filterNlike: FilterOperation;
  filterBlank: FilterOperation;
  filterNotblank: FilterOperation;
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
export interface FieldHandlerInterface {
  select(qb: Knex.QueryBuilder, column: Column, options: FilterOptions): void;
  filter(
    knex: Knex,
    filter: Filter,
    column: Column,
    options?: FilterOptions,
  ): Promise<(qb: Knex.QueryBuilder) => void>;
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
  ): Promise<(qb: Knex.QueryBuilder) => void>;

  applyFilters(
    filters: Filter[],
    options?: FilterOptions,
  ): Promise<(qb: Knex.QueryBuilder) => void>;

  applySelect(
    qb: Knex.QueryBuilder,
    column: Column,
    options?: FilterOptions,
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
