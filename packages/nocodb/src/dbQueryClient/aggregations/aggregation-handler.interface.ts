import type { AggregationCategory, FormulaDataTypes } from 'nocodb-sdk';
import type CustomKnex from '~/db/CustomKnex';
import type { Knex } from '~/db/CustomKnex';
import type { IBaseModelSqlV2 } from '~/db/IBaseModelSqlV2';
import type { Column } from '~/models';
import type { AggregationGeneratorParams } from '~/dbQueryClient/types';

/**
 * Per-dialect aggregation SQL strategy.
 *
 * Mirrors the `field-handler` registry (see `~/db/field-handler`): each database
 * dialect owns a handler class that knows how to translate a (column,
 * aggregation) pair into the dialect's SQL. A `GenericAggregationHandler` base
 * supplies the shared scaffolding (category dispatch + COALESCE/alias wrap) and
 * concrete handlers override the per-category SQL.
 */
export interface AggregationHandlerInterface {
  /**
   * Build the final aggregate SQL fragment (already COALESCE-wrapped and
   * aliased) for the given params, or `undefined` when the aggregation produced
   * no expression (e.g. `none`).
   */
  generate(params: AggregationGeneratorParams): string | undefined;
}

/**
 * Resolved context handed to each category method. Carries the dialect-agnostic
 * inputs plus the values each dialect's `buildContext()` derives (empty-cell
 * sentinel, materialized-column sources, etc.). Dialect-specific fields are
 * optional — a handler only populates what it needs.
 */
export interface AggregationSqlContext {
  knex: CustomKnex;
  baseModelSqlv2: IBaseModelSqlV2;
  column: Column;
  aggregation: string;
  aggType: AggregationCategory;
  alias?: string;
  parsedFormulaType?: FormulaDataTypes;
  /** SELECT expression for the column (raw col or compiled virtual-column SQL). */
  column_query: string | Knex.QueryBuilder | Knex.Raw;

  /** Dialect "empty" sentinel used by count-empty / count-filled predicates. */
  condnValue?: any;

  /**
   * Inline column expression. Plain dialects use `column_query`; mssql/oracle
   * point this at the materialized `nc_val` when a virtual column is involved.
   */
  cq?: string | Knex.QueryBuilder | Knex.Raw;

  /** FROM source for self-contained-subquery aggregates (median/attachment/std_dev). */
  subAggFrom?: string | Knex.Raw;
  /** Column reference within `subAggFrom`. */
  subAggCol?: string | Knex.QueryBuilder | Knex.Raw;

  /** mssql/oracle: whether the column was materialized into a derived table. */
  materialize?: boolean;
  /** mssql/oracle: the filtered derived table exposing `nc_val`. */
  derivedInner?: Knex.QueryBuilder;
}
