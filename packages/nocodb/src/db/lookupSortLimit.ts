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
 * (aliased `alias`, rows from `refBaseModel` — the immediate related table),
 * whose row order feeds the aggregation (json_agg) that renders the cell.
 *
 * "First N": order by the configured sort (or leave natural order) then LIMIT.
 * "Last N": we still need the TAIL of the sort, but the cell must present it in
 *   the ORIGINAL order (not reversed). LIMIT only takes the head, so we select
 *   the tail's pk set with a correlated pk-IN sub-query ordered by the *flipped*
 *   sort + LIMIT (via {@link applyLookupPkInLimit}), then order the outer rows by
 *   the *un-flipped* sort — no outer LIMIT needed, the pk-IN already restricts to
 *   N. This keeps "last N" both correct (the tail) and in natural display order.
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

  // "Last N": pick the tail as a pk set, then present it in the original order.
  if (takeLast && limitVal > 0) {
    await applyLookupPkInLimit({
      qb,
      alias,
      refBaseModel,
      sorts,
      limitVal,
      takeLast,
    });
    if (sorts.length) {
      await sortV2(refBaseModel, sorts, qb, alias);
    } else {
      if (!refBaseModel.model.columns?.length) {
        await refBaseModel.model.getColumns(refBaseModel.context);
      }
      const pks = refBaseModel.model.primaryKeys?.length
        ? refBaseModel.model.primaryKeys
        : refBaseModel.model.primaryKey
        ? [refBaseModel.model.primaryKey]
        : [];
      for (const pk of pks) qb.orderBy(`${alias}.${pk.column_name}`, 'asc');
    }
    return;
  }

  // "First N" / sort-only: order by the configured sort, then limit the head.
  if (sorts.length) {
    await sortV2(refBaseModel, sorts, qb, alias);
  } else if (limitVal > 0) {
    // No configured sort but a limit is set → without an ORDER BY, `LIMIT n`
    // returns an arbitrary (and unstable) N rows. Add a deterministic pk asc
    // fallback so the SET is stable (mirrors the Last-N branch above and the
    // mm/hm sibling in ee/dbQueryClient/pg.ts).
    if (!refBaseModel.model.columns?.length) {
      await refBaseModel.model.getColumns(refBaseModel.context);
    }
    const pks = refBaseModel.model.primaryKeys?.length
      ? refBaseModel.model.primaryKeys
      : refBaseModel.model.primaryKey
      ? [refBaseModel.model.primaryKey]
      : [];
    for (const pk of pks) qb.orderBy(`${alias}.${pk.column_name}`, 'asc');
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
  if (!ordered) {
    // No scalar sort configured → order by pk so the LIMITed pk SET is
    // deterministic (asc for first-N, desc for last-N). Without this the pk-IN
    // set is arbitrary and can change between requests.
    for (const pk of pks)
      inner.orderBy(`${alias}.${pk.column_name}`, takeLast ? 'desc' : 'asc');
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
 * Nested-level variant: restrict a nested lookup level's joined rows (`nestedAlias`,
 * from `nestedRefBaseModel`) to the top-N per the PREVIOUS level's row, via a
 * correlated
 *   ... AND <nestedAlias>.<pk> IN (SELECT <pk> FROM <nested table> t
 *                                  WHERE t.<corrCol> = <prevAlias>.<prevCorrCol>
 *                                  ORDER BY <sortkey> LIMIT n)
 * subquery. The nested loop join-flattens levels, so unlike the outer level there
 * is no per-level qb to clone — the correlation is built explicitly from the
 * level's relation columns. Single PK + scalar sort columns only.
 */
export async function applyNestedLookupLevelLimit(param: {
  qb: Knex.QueryBuilder;
  nestedAlias: string;
  nestedRefBaseModel: IBaseModelSqlV2;
  corrColName: string;
  prevAlias: string;
  prevCorrColName: string;
  sorts: Sort[];
  limitVal: number;
  takeLast: boolean;
}): Promise<void> {
  const applier = await buildNestedLookupLevelLimit(param);
  if (applier) applier(param.qb);
}

/**
 * Deferred variant of {@link applyNestedLookupLevelLimit}: builds the correlated
 * pk-IN sub-query eagerly (needs async column resolution) and returns a sync
 * applier `(qb) => void`, or `null` when there's nothing to limit. Used by the
 * filter path, where the nested joins live in a `qb` that isn't available until
 * the deferred clauses run (see nestedConditionJoin). The correlation only
 * references string aliases known at build time, so deferring the final
 * `whereIn` is safe.
 */
export async function buildNestedLookupLevelLimit(param: {
  nestedAlias: string;
  nestedRefBaseModel: IBaseModelSqlV2;
  corrColName: string;
  prevAlias: string;
  prevCorrColName: string;
  sorts: Sort[];
  limitVal: number;
  takeLast: boolean;
}): Promise<((qb: Knex.QueryBuilder) => void) | null> {
  const {
    nestedAlias,
    nestedRefBaseModel,
    corrColName,
    prevAlias,
    prevCorrColName,
    sorts,
    limitVal,
    takeLast,
  } = param;
  if (limitVal <= 0) return null;

  const knex = nestedRefBaseModel.dbDriver;
  if (!nestedRefBaseModel.model.columns?.length) {
    await nestedRefBaseModel.model.getColumns(nestedRefBaseModel.context);
  }
  const cols = nestedRefBaseModel.model.columns || [];
  const pk = nestedRefBaseModel.model.primaryKey;
  if (!pk) return null;

  const ia = '__nc_lk_nlvl';
  const tnPath = nestedRefBaseModel.getTnPath(
    nestedRefBaseModel.model.table_name,
  );

  const inner = knex(knex.raw('?? as ??', [tnPath, ia]))
    .select(`${ia}.${pk.column_name}`)
    .where(
      knex.ref(`${ia}.${corrColName}`),
      '=',
      knex.ref(`${prevAlias}.${prevCorrColName}`),
    );

  const softDelete = await getAliasedSoftDeleteFilter(nestedRefBaseModel, ia);
  if (softDelete) inner.where(softDelete);

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
        `${ia}.${col.column_name}`,
        s.direction === 'desc' ? 'desc' : 'asc',
      );
      ordered = true;
    }
  }
  if (!ordered) {
    // No scalar sort configured → order by pk so the LIMITed set is
    // deterministic (asc for first-N, desc for last-N).
    inner.orderBy(`${ia}.${pk.column_name}`, takeLast ? 'desc' : 'asc');
  }
  inner.limit(limitVal);

  return (qb: Knex.QueryBuilder) =>
    qb.whereIn(`${nestedAlias}.${pk.column_name}`, inner);
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
