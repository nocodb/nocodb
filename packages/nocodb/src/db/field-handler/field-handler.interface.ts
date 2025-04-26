import type { IBaseModelSqlV2 } from '../IBaseModelSqlV2';
import type { MetaService } from 'src/meta/meta.service';
import type { FilterType, NcContext } from 'nocodb-sdk';
import type { Knex } from 'knex';
import type { Column, Filter } from '~/models';

export interface HandlerOptions {
  alias?: string;
  throwErrorIfInvalid?: boolean; // required by formula and lookup
  context?: NcContext;
  baseModel?: IBaseModelSqlV2; // required by formula and lookup
  metaService?: MetaService;
  knex?: Knex;
  tnPath?: string;
  fieldHandler?: IFieldHandler;
  depth?: { count: number }; // required by formula and lookup for alias
  conditionParser?: (
    baseModelSqlv2: IBaseModelSqlV2,
    _filter: Filter | FilterType | FilterType[] | Filter[],
    aliasCount: { count: number },
    alias?: string,
    customWhereClause?: string,
    throwErrorIfInvalid?: boolean,
  ) => Promise<(qbP: Knex.QueryBuilder) => void>; // backward compatibility aimed to conditionV2.parseConditionV2
}
export interface FilterVerificationResult {
  isValid: boolean;
  errors?: string[];
}
export interface FieldHandlerInterface {
  select(qb: Knex.QueryBuilder, column: Column, options: HandlerOptions): void;
  filter(
    knex: Knex,
    filter: Filter,
    column: Column,
    options?: HandlerOptions,
  ): Promise<(qb: Knex.QueryBuilder) => void>;
  verifyFilter(
    filter: Filter,
    column: Column,
    options?: HandlerOptions,
  ): Promise<FilterVerificationResult>;

  parseValue(params: {
    value: any;
    row: any;
    column: Column;
    baseModel: IBaseModelSqlV2;
    options?: {
      context?: NcContext;
      metaService?: MetaService;
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
    options?: HandlerOptions,
  ): Promise<(qb: Knex.QueryBuilder) => void>;

  applyFilters(
    filters: Filter[],
    options?: HandlerOptions,
  ): Promise<(qb: Knex.QueryBuilder) => void>;

  applySelect(
    qb: Knex.QueryBuilder,
    column: Column,
    options?: HandlerOptions,
  ): Promise<void>;

  verifyFilter(
    filter: Filter,
    column: Column,
    options?: HandlerOptions,
  ): Promise<FilterVerificationResult>;

  verifyFiltersSafe(
    filters: Filter[],
    options?: HandlerOptions,
  ): Promise<FilterVerificationResult>;

  verifyFilters(filters: Filter[], options?: HandlerOptions): Promise<boolean>;

  parseValue(params: {
    value: any;
    row: any;
    column: Column;
    baseModel: IBaseModelSqlV2;
    options?: {
      context?: NcContext;
      metaService?: MetaService;
    };
  }): Promise<{ value: any }>;
}
