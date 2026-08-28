import type { Knex } from 'knex';
import type { ClientType, NcContext } from 'nocodb-sdk';
import type CustomKnex from '~/db/CustomKnex';
import type { ICteBlock } from '~/db/cte-generator/types';

/** Column name every lookup block exposes its key under. */
export const CTE_KEY = 'k';
/** Column name every lookup block exposes its value under. */
export const CTE_VALUE = 'v';

/**
 * Stable alias for a hoisted lookup. Aggregate blocks include the aggregate
 * function because `getAggregateFn(pt.fnName)` makes a to-many lookup's SQL
 * depend on its enclosing formula function — `SUM({L})` and `MIN({L})` are
 * genuinely different queries and must not share a block. Flatten blocks carry
 * no aggregate (it is applied at the reference site) so they key on the column
 * alone and dedupe across every reference.
 */
export function lookupCteAlias({
  columnId,
  aggregateFn,
}: {
  columnId: string;
  aggregateFn?: string;
}) {
  return aggregateFn
    ? `nc_lk_${columnId}_${aggregateFn.toLowerCase()}`
    : `nc_lk_${columnId}`;
}

export interface LookupCteReferenceParams {
  knex: CustomKnex;
  /** alias of the table the formula is selecting from */
  rootAlias: string;
  /** column on the root table the block's key matches */
  rootKeyColumn: string;
  /** applied to the block's value column; omit for to-one lookups */
  aggregate?: (valueColumn: Knex.Raw) => Knex.Raw;
}

export interface LookupCteExtra {
  /**
   * Read the block as a scalar sub-query. Deliberately not a join: it keeps the
   * expression shape the inline emitter already produces, so it drops into the
   * reference site unchanged and cannot multiply rows.
   */
  reference: (param: LookupCteReferenceParams) => Knex.Raw;
}

export function buildLookupCteBlock({
  alias,
  select,
}: {
  alias: string;
  select: Knex.Raw | Knex.QueryBuilder;
}): ICteBlock<LookupCteExtra> {
  return {
    alias,
    applyCte: (qb: Knex.QueryInterface) => {
      (qb as Knex.QueryBuilder).with(alias, select as any);
    },
    extra: {
      reference: ({
        knex,
        rootAlias,
        rootKeyColumn,
        aggregate,
      }: LookupCteReferenceParams) => {
        const valueColumn = knex.raw('??', [`${alias}.${CTE_VALUE}`]);
        const projected = aggregate ? aggregate(valueColumn) : valueColumn;
        return knex.raw(`(select ? from ?? where ?? = ??)`, [
          projected,
          alias,
          `${alias}.${CTE_KEY}`,
          `${rootAlias}.${rootKeyColumn}`,
        ]);
      },
    },
  };
}

/**
 * Registered as the `lookup` module on CTEGenerator — the slot its
 * `getCteModules` signature has always declared but nothing filled.
 */
export class LookupGeneralCte {
  constructor(protected readonly clientType: ClientType) {}

  inquiry(
    {
      columnId,
      aggregateFn,
      select,
    }: {
      context?: NcContext;
      columnId: string;
      aggregateFn?: string;
      select: Knex.Raw | Knex.QueryBuilder;
    },
    cteGen: { getExistingAlias(alias: string): ICteBlock },
  ): ICteBlock<LookupCteExtra> {
    const alias = lookupCteAlias({ columnId, aggregateFn });
    const existing = cteGen.getExistingAlias(alias);
    if (existing) return existing as ICteBlock<LookupCteExtra>;
    return buildLookupCteBlock({ alias, select });
  }
}
