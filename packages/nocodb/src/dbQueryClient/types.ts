import type {
  AggregationCategory,
  ClientType,
  FormulaDataTypes,
} from 'nocodb-sdk';
import type CustomKnex from '~/db/CustomKnex';
import type { Knex, XKnex } from '~/db/CustomKnex';
import type { IBaseModelSqlV2 } from '~/db/IBaseModelSqlV2';
import type { Column, Filter, Model, Source, View } from '~/models';
import type { NcContext } from '~/interface/config';

/** Payload passed from the prelude to each dialect's `generateAggregateQuery`. */
export interface AggregationGeneratorParams {
  column: Column;
  baseModelSqlv2: IBaseModelSqlV2;
  aggregation: string;
  column_query: string | Knex.QueryBuilder | Knex.Raw;
  parsedFormulaType?: FormulaDataTypes;
  aggType: AggregationCategory;
  alias?: string;
  baseQuery?: Knex.QueryBuilder;
}

/** Caller payload for `client.aggregate()`. */
export interface AggregateCtx {
  model: Model;
  view?: View;
  source: Source;
  args: {
    filterArr?: Filter[];
    where?: string;
    /** Explicit `(column, type)` pairs — REQUIRED when no view is passed. */
    aggregation?: Array<{ field: string; type: string }>;
  };
}

/** Caller payload for `client.bulkAggregate()` — N filter sets. */
export interface BulkAggregateCtx extends AggregateCtx {
  bulkFilterList: Array<{
    alias: string;
    where?: string;
    filterArrJson?: string | Filter[];
  }>;
}

export interface DBQueryClient {
  get clientType(): ClientType;

  dbVersion?: string;

  validateClientType(client: string): void;
  temporaryTable(payload: {
    data: Record<string, any>[];
    fields: string[];
    alias: string;
    knex: XKnex;
  }): Knex.QueryInterface;

  temporaryTableRaw(payload: {
    data: Record<string, any>[];
    fields: string[];
    alias: string;
    knex: XKnex;
  }): Knex.Raw;

  /**
   * Table-position alias fragment for FROM/JOIN targets. Dialect-owned
   * because the SQL differs: Oracle rejects `AS` before table aliases
   * (ORA-00907), every other dialect accepts it.
   */
  tableAlias(knex: XKnex, table: string | Knex.Raw, alias: string): Knex.Raw;

  /**
   * Bulk-update rows by primary key in a single round trip.
   */
  batchUpdate(payload: {
    knex: XKnex;
    tnPath: string | Knex.Raw;
    rows: Record<string, any>[];
    pkColumnName: string;
  }): Knex.QueryBuilder | Knex.Raw | null;

  concat(fields: string[]);
  simpleCast(field: string, asType: string);

  /**
   * Split `needleColumn` by `delimiter`, replace each token via the `stack`
   * key→value map, and re-aggregate into a delimited string. Used by
   * conditionV2 + the user field-handlers so user-id columns can be
   * filtered/grouped by their display names. Implemented for pg + sqlite.
   */
  replaceDelimitedWithKeyValue(params: {
    knex: CustomKnex;
    stack: { key: string; value: string }[];
    needleColumn: string | Knex.QueryBuilder | Knex.RawBuilder;
    delimiter?: string;
  }): string;

  /** Dialect-specific aggregation SQL generator. */
  generateAggregateQuery(
    params: AggregationGeneratorParams,
  ): string | undefined;

  /** Single-filter-set view-footer aggregation. */
  aggregate(
    context: NcContext,
    ctx: AggregateCtx,
  ): Promise<Record<string, unknown>>;

  /** N-filter-set bulk aggregation (per-set filtered expression generation). */
  bulkAggregate(
    context: NcContext,
    ctx: BulkAggregateCtx,
  ): Promise<Record<string, Record<string, unknown>>>;

  /** Dialect-specific JSON-pack of per-set aggregate expressions. */
  bulkAggregateRowSelector(
    baseModel: IBaseModelSqlV2,
    tQb: Knex.QueryBuilder,
    expressions: Record<string, string>,
    alias: string,
  ): Knex.Raw;

  /**
   * Last-resort ORDER BY injection on a list/sub-list query right before
   * pagination is applied. Called by cross-db list orchestration AFTER the
   * usual ORDER BY branches (user sorts, view sorts, Order column, PK,
   * system CreatedTime) have had a chance to add one.
   *
   * Implementations MUST be idempotent — they may be called even if an
   * ORDER BY is already attached. The simplest correct implementation
   * inspects `qb` and short-circuits.
   */
  ensurePaginationOrderBy(qb: Knex.QueryBuilder, model: Model): void;
}
