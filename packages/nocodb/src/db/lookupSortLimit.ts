import { parseProp } from 'nocodb-sdk';
import type { Knex } from 'knex';
import type { NcContext } from '~/interface/config';
import type { Column } from '~/models';
import type { IBaseModelSqlV2 } from '~/db/IBaseModelSqlV2';
import Sort from '~/models/Sort';
import sortV2 from '~/db/sortV2';
import { getAliasedSoftDeleteFilter } from '~/helpers/dbHelpers';

/**
 * Per-lookup Sort + Limit — the CE core shared by every consumer of a lookup's
 * relation sub-query so they all see the same limited/sorted set:
 *   - display  : ee/dbQueryClient/pg.ts (via the licensed wrapper in ee/helpers)
 *   - filter/sort/group-by : generateLookupSelectQuery
 *   - formula  : formulav2/lookup-or-ltar-builder
 *
 * Config lives in the Sort table (`fk_lookup_col_id`) + column `meta.lookup_limit`
 * and is only ever created by the EE, licensed UI — so a `hasConfig` check is the
 * de-facto gate here (CE can't import the license helper). The display path adds
 * an explicit license gate on top; callers PG-gate (the feature is PG-only).
 */
export interface LookupSortLimitConfig {
  sorts: Sort[];
  limitVal: number;
  takeLast: boolean;
  hasConfig: boolean;
}

export async function loadLookupSortAndLimit(
  context: NcContext,
  column: Column,
): Promise<LookupSortLimitConfig> {
  const meta = (parseProp(column.meta) || {}) as {
    lookup_limit?: { type?: 'first' | 'last'; value?: number };
  };
  const limitVal = +(meta.lookup_limit?.value ?? 0) || 0;
  const sorts = await Sort.listByLookupColumn(context, { columnId: column.id });
  const takeLast = meta.lookup_limit?.type === 'last' && limitVal > 0;
  return {
    sorts,
    limitVal,
    takeLast,
    hasConfig: sorts.length > 0 || limitVal > 0,
  };
}

/**
 * Apply an (already-loaded) lookup sort+limit to the relation sub-query `qb`
 * (aliased `alias`, rows from `refBaseModel` — the immediate related table).
 * "Last N" reverses the configured sort (or, with no sort, the primary-key
 * order) before limiting so the tail is taken.
 */
export async function applyLookupSortLimitToQb(param: {
  qb: Knex.QueryBuilder;
  alias: string;
  refBaseModel: IBaseModelSqlV2;
  sorts: Sort[];
  limitVal: number;
  takeLast: boolean;
}): Promise<void> {
  const { qb, alias, refBaseModel, sorts, limitVal, takeLast } = param;

  if (sorts.length) {
    const effective = takeLast
      ? sorts.map(
          (s) =>
            new Sort({
              ...s,
              direction: s.direction === 'desc' ? 'asc' : 'desc',
            }),
        )
      : sorts;
    await sortV2(refBaseModel, effective, qb, alias);
  } else if (takeLast) {
    if (!refBaseModel.model.columns?.length) {
      await refBaseModel.model.getColumns(refBaseModel.context);
    }
    const pks = refBaseModel.model.primaryKeys?.length
      ? refBaseModel.model.primaryKeys
      : refBaseModel.model.primaryKey
      ? [refBaseModel.model.primaryKey]
      : [];
    for (const pk of pks) {
      qb.orderBy(`${alias}.${pk.column_name}`, 'desc');
    }
  }

  if (limitVal > 0) qb.limit(limitVal);
}

/**
 * Restrict a lookup's base correlated row query `qb` (aliased `alias`, rows from
 * `refBaseModel`) to the top-N rows of the configured sort, via a correlated
 *   ... AND <alias>.<pk> IN (SELECT <pk> FROM <same rows> ORDER BY <sortkey> LIMIT n)
 * subquery. Unlike putting ORDER BY/LIMIT on the query directly, this composes
 * with whatever the CONSUMER does with the rows afterwards (STRING_AGG in a
 * formula, json_agg for a sort key, an EXISTS in a filter) — the outer query
 * stays a valid aggregate/EXISTS while only the top-N rows are considered. Built
 * by cloning `qb` so the exact relation correlation is reused.
 *
 * Only the LIMIT case needs this (sort-only affects presentation order, handled
 * elsewhere); a no-op when there's no limit or the related table has no PK.
 */
export async function applyLookupPkInLimit(param: {
  qb: Knex.QueryBuilder;
  alias: string;
  refBaseModel: IBaseModelSqlV2;
  sorts: Sort[];
  limitVal: number;
  takeLast: boolean;
}): Promise<void> {
  const { qb, alias, refBaseModel, sorts, limitVal, takeLast } = param;
  if (limitVal <= 0) return;

  if (!refBaseModel.model.columns?.length) {
    await refBaseModel.model.getColumns(refBaseModel.context);
  }
  const cols = refBaseModel.model.columns || [];
  const pks = refBaseModel.model.primaryKeys?.length
    ? refBaseModel.model.primaryKeys
    : refBaseModel.model.primaryKey
    ? [refBaseModel.model.primaryKey]
    : [];
  if (!pks.length) return;

  const inner = qb.clone();
  // Return only the pk(s) — the correlation WHERE is carried over by the clone.
  if (typeof (inner as any).clearSelect === 'function') {
    (inner as any).clearSelect();
  }
  for (const pk of pks) inner.select(`${alias}.${pk.column_name}`);

  // Order by the configured sort columns (scalar columns only — resolved by
  // name to keep the subquery projecting just the pk). "Last N" flips direction.
  const effective = takeLast
    ? sorts.map(
        (s) =>
          new Sort({
            ...s,
            direction: s.direction === 'desc' ? 'asc' : 'desc',
          }),
      )
    : sorts;
  let ordered = false;
  for (const s of effective) {
    const col = cols.find((c) => c.id === s.fk_column_id);
    if (col?.column_name) {
      inner.orderBy(
        `${alias}.${col.column_name}`,
        s.direction === 'desc' ? 'desc' : 'asc',
      );
      ordered = true;
    }
  }
  if (!ordered && takeLast) {
    for (const pk of pks) inner.orderBy(`${alias}.${pk.column_name}`, 'desc');
  }
  inner.limit(limitVal);

  if (pks.length === 1) {
    qb.whereIn(`${alias}.${pks[0].column_name}`, inner);
  } else {
    qb.whereIn(
      pks.map((pk) => `${alias}.${pk.column_name}`),
      inner,
    );
  }
}

/**
 * Filter variant: restrict the filter's related-row set `qb` (aliased `alias`,
 * which selects the FK `fkColumnName` back to the parent and already carries the
 * user's comparison) to the top-N related rows PER PARENT.
 *
 * The filter's `qb` is a global set matched via `parent IN (qb)`, not a
 * per-parent correlated subquery — so a plain LIMIT/pk-IN can't express
 * "top-N per parent". Instead rank the BASE related rows with
 *   ROW_NUMBER() OVER (PARTITION BY <fk> ORDER BY <sortkey>)
 * and keep only rn <= N, then AND that pk set onto `qb`. Ranking the base rows
 * (independent of the comparison) is what makes "contains X" match only when X
 * is within the visible top-N. Single PK only; scalar sort columns only.
 */
export async function applyLookupFilterWindowLimit(param: {
  qb: Knex.QueryBuilder;
  alias: string;
  fkColumnName: string;
  refBaseModel: IBaseModelSqlV2;
  sorts: Sort[];
  limitVal: number;
  takeLast: boolean;
}): Promise<void> {
  const { qb, alias, fkColumnName, refBaseModel, sorts, limitVal, takeLast } =
    param;
  if (limitVal <= 0) return;

  const knex = refBaseModel.dbDriver;
  if (!refBaseModel.model.columns?.length) {
    await refBaseModel.model.getColumns(refBaseModel.context);
  }
  const cols = refBaseModel.model.columns || [];
  const pk = refBaseModel.model.primaryKey;
  if (!pk) return; // composite / no PK → skip

  const ra = '__nc_lk_win';
  const tnPath = refBaseModel.getTnPath(refBaseModel.model.table_name);

  // ORDER BY inside the window — scalar sort columns, "last N" flips direction.
  const effective = takeLast
    ? sorts.map(
        (s) =>
          new Sort({
            ...s,
            direction: s.direction === 'desc' ? 'asc' : 'desc',
          }),
      )
    : sorts;
  const orderBits: string[] = [];
  const orderBindings: string[] = [];
  for (const s of effective) {
    const col = cols.find((c) => c.id === s.fk_column_id);
    if (col?.column_name) {
      orderBits.push(`??.?? ${s.direction === 'desc' ? 'desc' : 'asc'}`);
      orderBindings.push(ra, col.column_name);
    }
  }
  if (!orderBits.length) {
    orderBits.push(`??.?? ${takeLast ? 'desc' : 'asc'}`);
    orderBindings.push(ra, pk.column_name);
  }

  const win = knex(knex.raw('?? as ??', [tnPath, ra]))
    .select(knex.raw('??.?? as __nc_pk', [ra, pk.column_name]))
    .select(
      knex.raw(
        `ROW_NUMBER() OVER (PARTITION BY ??.?? ORDER BY ${orderBits.join(
          ', ',
        )}) as __nc_rn`,
        [ra, fkColumnName, ...orderBindings],
      ),
    );

  const softDelete = await getAliasedSoftDeleteFilter(refBaseModel, ra);
  if (softDelete) win.where(softDelete);

  const ranked = knex
    .select('__nc_pk')
    .from(win.as('__nc_lk_win_sub'))
    .where('__nc_rn', '<=', limitVal);

  qb.whereIn(`${alias}.${pk.column_name}`, ranked);
}
