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
 * Phase 1 (no viewId): Numbers all rows sequentially ordered by created_at ASC, nc_id ASC.
 *
 * Phase 2 (with viewId): Numbers rows based on the view's filter and sort configuration.
 * Matching rows (satisfying filter) are numbered 1..N ordered by view sort.
 * Non-matching rows are numbered N+1..M ordered by view sort.
 *
 * After backfill, the PostgreSQL sequence is reset to MAX+1 so subsequent inserts continue.
 *
 * @param context - NocoDB context (workspace/base)
 * @param model - The table model
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
  const knex = await NcConnectionMgrv2.get(source);
  const tableName = model.table_name;
  const colName = column.column_name;

  if (viewId) {
    await backfillWithViewOrder(context, model, column, source, knex, viewId);
  } else {
    await backfillDefaultOrder(knex, tableName, colName);
  }

  // Reset PG sequence so new inserts continue from MAX+1
  await resetPgSequence(knex, tableName, colName);
}

/**
 * Default backfill: numbers all rows ordered by created_at ASC, nc_id ASC.
 * Uses a single atomic UPDATE with ROW_NUMBER() window function (PG only).
 */
async function backfillDefaultOrder(
  knex: any,
  tableName: string,
  colName: string,
): Promise<void> {
  await knex.raw(
    `UPDATE ?? SET ?? = sub.rn
     FROM (
       SELECT nc_id,
         ROW_NUMBER() OVER (ORDER BY created_at ASC, nc_id ASC) AS rn
       FROM ??
     ) sub
     WHERE ??.nc_id = sub.nc_id`,
    [tableName, colName, tableName, tableName],
  );
}

/**
 * View-aware backfill: numbers matching rows (satisfying view filter) first,
 * ordered by view sort. Non-matching rows are numbered after, also ordered by view sort.
 *
 * Algorithm:
 * 1. Fetch ordered matching row IDs using view filter + sort
 * 2. Collect all matching IDs as a set
 * 3. Fetch all remaining row IDs (not in matching set) ordered by view sort
 * 4. Batch UPDATE: matching rows get 1..N, non-matching get N+1..M
 */
async function backfillWithViewOrder(
  context: NcContext,
  model: Model,
  _column: Column,
  source: Source,
  knex: any,
  viewId: string,
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
  const matchingQb = knex(tableName).select('nc_id');
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
  const matchingRows: Array<{ nc_id: string }> = await matchingQb;
  const matchingIdSet = new Set(matchingRows.map((r) => r.nc_id));

  // Query 2: non-matching rows — all rows not in matching set, ordered by view sort
  const nonMatchingQb = knex(tableName)
    .select('nc_id')
    .whereNotIn('nc_id', [...matchingIdSet]);
  if (sorts?.length) {
    await sortV2(baseModel, sorts, nonMatchingQb);
  }
  const nonMatchingRows: Array<{ nc_id: string }> = await nonMatchingQb;

  // Assign sequential values: matching 1..N, non-matching N+1..M
  const allOrdered = [
    ...matchingRows.map((r, i) => ({ nc_id: r.nc_id, val: i + 1 })),
    ...nonMatchingRows.map((r, i) => ({
      nc_id: r.nc_id,
      val: matchingRows.length + i + 1,
    })),
  ];

  if (!allOrdered.length) return;

  // Batch UPDATE in chunks of 10k to avoid oversized queries
  const BATCH_SIZE = 10_000;
  for (let i = 0; i < allOrdered.length; i += BATCH_SIZE) {
    const batch = allOrdered.slice(i, i + BATCH_SIZE);

    // Build VALUES list: (nc_id, val) pairs
    const valueParts = batch.map(() => '(?, ?)').join(', ');
    const valueBindings = batch.flatMap((r) => [r.nc_id, r.val]);

    await knex.raw(
      `UPDATE ?? SET ?? = vals.val
       FROM (VALUES ${valueParts}) AS vals(nc_id, val)
       WHERE ??.nc_id = vals.nc_id`,
      [tableName, colName, ...valueBindings, tableName],
    );
  }
}
