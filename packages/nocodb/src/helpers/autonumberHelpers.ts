import { Filter, Model, Sort } from '~/models';
import type { Column, Source } from '~/models';
import type { NcContext } from '~/interface/config';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';
import conditionV2 from '~/db/conditionV2';
import sortV2 from '~/db/sortV2';

/**
 * Resets a PostgreSQL BIGSERIAL sequence to MAX(column) after a backfill.
 * This ensures new inserts continue from the correct next value.
 */
export async function resetPgSequence(
  knex: any,
  tableName: string,
  colName: string,
): Promise<void> {
  await knex.raw(
    `SELECT setval(
      pg_get_serial_sequence(?, ?),
      (SELECT COALESCE(MAX(??) , 0) FROM ??)
    )`,
    [tableName, colName, colName, tableName],
  );
}

/**
 * Backfills an AutoNumber column on an existing PostgreSQL table.
 *
 * Uses the table's primary key as the row identifier — same approach as
 * the order column migration (nc_job_005_order_column). If no primary key
 * exists the backfill is skipped (sequence reset still runs).
 *
 * Phase 1 (no viewId): Numbers all rows sequentially ordered by PK ASC.
 *
 * Phase 2 (with viewId): Numbers rows based on the view's filter and sort.
 * Matching rows (satisfying filter) are numbered 1..N ordered by view sort.
 * Non-matching rows are numbered N+1..M ordered by view sort.
 *
 * After backfill, the PostgreSQL sequence is reset to MAX+1 so subsequent inserts continue.
 *
 * @param context - NocoDB context (workspace/base)
 * @param model - The table model (columns must be loaded or will be loaded here)
 * @param column - The newly created AutoNumber column
 * @param source - The data source
 * @param viewId - Optional view ID for view-aware ordering (Phase 2)
 */
export async function backfillAutoNumber(
  context: NcContext,
  model: Model,
  column: Column,
  source: Source,
  viewId?: string,
): Promise<void> {
  // Ensure columns are loaded so primaryKeys is populated
  if (!model.columns) {
    await model.getColumns(context);
  }

  const pkColumn = model.primaryKeys?.[0]?.column_name;

  const knex = await NcConnectionMgrv2.get(source);
  const tableName = model.table_name;
  const colName = column.column_name;

  if (pkColumn) {
    if (viewId) {
      await backfillWithViewOrder(
        context,
        model,
        column,
        source,
        knex,
        viewId,
        pkColumn,
      );
    } else {
      await backfillDefaultOrder(knex, tableName, colName, pkColumn);
    }
  }

  // Reset PG sequence so new inserts continue from MAX+1
  await resetPgSequence(knex, tableName, colName);
}

/**
 * Default backfill: numbers all rows ordered by primary key ASC.
 *
 * Uses the same ROW_NUMBER() window function pattern as nc_job_005_order_column.
 * Single atomic UPDATE — no row-by-row loops.
 *
 * SQL (PG):
 *   UPDATE "t" t SET "col" = s.rn
 *   FROM (SELECT "pk", ROW_NUMBER() OVER (ORDER BY "pk" ASC) rn FROM "t") s
 *   WHERE t."pk" = s."pk"
 */
async function backfillDefaultOrder(
  knex: any,
  tableName: string,
  colName: string,
  pkColumn: string,
): Promise<void> {
  await knex.raw(
    `UPDATE ?? t SET ?? = s.rn
     FROM (SELECT ??, ROW_NUMBER() OVER (ORDER BY ?? ASC) rn FROM ??) s
     WHERE t.?? = s.??`,
    [tableName, colName, pkColumn, pkColumn, tableName, pkColumn, pkColumn],
  );
}

/**
 * View-aware backfill: numbers matching rows (satisfying view filter) first,
 * ordered by view sort. Non-matching rows are numbered after, also ordered by view sort.
 *
 * Algorithm:
 * 1. Fetch ordered matching row PKs using view filter + sort
 * 2. Collect all matching PKs as a set
 * 3. Fetch all remaining row PKs (not in matching set) ordered by view sort
 * 4. Batch UPDATE: matching rows get 1..N, non-matching get N+1..M
 */
async function backfillWithViewOrder(
  context: NcContext,
  model: Model,
  _column: Column,
  source: Source,
  knex: any,
  viewId: string,
  pkColumn: string,
): Promise<void> {
  const tableName = model.table_name;
  const colName = _column.column_name;

  // Fetch view filters and sorts
  const filters = await Filter.rootFilterList(context, { viewId });
  const sorts = await Sort.list(context, { viewId });

  // Build a BaseModelSqlv2 instance for conditionV2/sortV2
  const baseModel = await Model.getBaseModelSQL(context, {
    id: model.id,
    dbDriver: knex,
    source,
  });

  // Query 1: matching rows (satisfying view filter), ordered by view sort
  const matchingQb = knex(tableName).select(pkColumn);
  if (filters?.length) {
    await conditionV2(
      baseModel,
      [
        new Filter({
          children: filters,
          is_group: true,
          logical_op: 'and',
        } as any),
      ],
      matchingQb,
    );
  }
  if (sorts?.length) {
    await sortV2(baseModel, sorts, matchingQb);
  }
  const matchingRows: Array<Record<string, unknown>> = await matchingQb;
  const matchingPkSet = new Set(matchingRows.map((r) => r[pkColumn]));

  // Query 2: non-matching rows — all rows not in matching set, ordered by view sort
  const nonMatchingQb = knex(tableName)
    .select(pkColumn)
    .whereNotIn(pkColumn, [...matchingPkSet]);
  if (sorts?.length) {
    await sortV2(baseModel, sorts, nonMatchingQb);
  }
  const nonMatchingRows: Array<Record<string, unknown>> = await nonMatchingQb;

  // Assign sequential values: matching 1..N, non-matching N+1..M
  const allOrdered = [
    ...matchingRows.map((r, i) => ({ pk: r[pkColumn], val: i + 1 })),
    ...nonMatchingRows.map((r, i) => ({
      pk: r[pkColumn],
      val: matchingRows.length + i + 1,
    })),
  ];

  if (!allOrdered.length) return;

  // Batch UPDATE in chunks of 10k to avoid oversized queries
  const BATCH_SIZE = 10_000;
  for (let i = 0; i < allOrdered.length; i += BATCH_SIZE) {
    const batch = allOrdered.slice(i, i + BATCH_SIZE);

    // Build VALUES list: (pk, val) pairs
    const valueParts = batch.map(() => '(?, ?)').join(', ');
    const valueBindings = batch.flatMap((r) => [r.pk, r.val]);

    await knex.raw(
      `UPDATE ?? SET ?? = vals.val
       FROM (VALUES ${valueParts}) AS vals(pk_col, val)
       WHERE ??.?? = vals.pk_col`,
      [tableName, colName, ...valueBindings, tableName, pkColumn],
    );
  }
}
