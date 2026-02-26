import { Filter, Model, Sort } from '~/models';
import type { BaseModelSqlv2 } from '~/db/BaseModelSqlv2';
import type { Column, Source } from '~/models';
import type { NcContext } from '~/interface/config';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';
import conditionV2 from '~/db/conditionV2';
import sortV2 from '~/db/sortV2';

/**
 * Resets a PostgreSQL BIGSERIAL sequence to MAX(column) after a backfill.
 */
async function resetPgSequence(
  knex: any,
  tnPath: string,
  colName: string,
): Promise<void> {
  await knex.raw(
    `SELECT setval(
      pg_get_serial_sequence(?, ?),
      COALESCE((SELECT MAX(??) FROM ??), 0)
    )`,
    [tnPath, colName, colName, tnPath],
  );
}

/**
 * Backfills an AutoNumber column on an existing PostgreSQL table.
 *
 * Default (no viewId): ROW_NUMBER() ordered by PK ASC.
 *
 * View-aware (with viewId): conditionV2 + sortV2 applied to a single QB,
 * then ARRAY() + unnest WITH ORDINALITY to number rows in SQL-preserved
 * order. Filtered rows get 1..N, non-filtered get N+1..M.
 *
 * After backfill, the PG sequence is reset to MAX+1.
 */
export async function backfillAutoNumber(
  context: NcContext,
  model: Model,
  column: Column,
  source: Source,
  viewId?: string,
): Promise<void> {
  if (!model.columns) {
    await model.getColumns(context);
  }

  const pkColumn = model.primaryKeys?.[0]?.column_name;
  const colName = column.column_name;

  const knex = await NcConnectionMgrv2.get(source);
  const baseModel = await Model.getBaseModelSQL(context, {
    id: model.id,
    dbDriver: knex,
    source,
  });
  const tnPath = baseModel.tnPath;

  if (pkColumn) {
    if (viewId) {
      await backfillWithViewOrder(baseModel, tnPath, colName, pkColumn, viewId);
    } else {
      await backfillDefaultOrder(knex, tnPath, colName, pkColumn);
    }
  }

  await resetPgSequence(knex, tnPath, colName);
}

/**
 * Default backfill: single atomic UPDATE using ROW_NUMBER() ordered by PK.
 */
async function backfillDefaultOrder(
  knex: any,
  tnPath: string,
  colName: string,
  pkColumn: string,
): Promise<void> {
  await knex.raw(
    `UPDATE ?? t SET ?? = s.rn
     FROM (SELECT ??, ROW_NUMBER() OVER (ORDER BY ?? ASC) rn FROM ??) s
     WHERE t.?? = s.??`,
    [tnPath, colName, pkColumn, pkColumn, tnPath, pkColumn, pkColumn],
  );
}

/**
 * View-aware backfill using conditionV2 + sortV2 on the same query builder.
 *
 * Both conditionV2 (adds WHERE/JOINs) and sortV2 (adds ORDER BY with scalar
 * subqueries) are applied to one QB — no SQL fragment extraction needed.
 *
 * PG's ARRAY(SELECT ... ORDER BY) preserves ordering. unnest WITH ORDINALITY
 * then gives us (pk, row_number) pairs.
 */
async function backfillWithViewOrder(
  baseModel: BaseModelSqlv2,
  tnPath: string,
  colName: string,
  pkColumn: string,
  viewId: string,
): Promise<void> {
  const context = baseModel.context;
  const knex = baseModel.dbDriver;

  const filters = await Filter.rootFilterList(context, { viewId });
  const sorts = await Sort.list(context, { viewId });

  if (filters?.length) {
    const filteredQb = knex(tnPath).select(pkColumn);
    await conditionV2(
      baseModel,
      [
        new Filter({
          children: filters,
          is_group: true,
          logical_op: 'and',
        } as any),
      ],
      filteredQb,
    );
    if (sorts?.length) {
      await sortV2(baseModel, sorts, filteredQb);
    }
    filteredQb.orderBy(pkColumn);

    const filteredSql = filteredQb.toQuery().replaceAll('?', '\\?');

    await knex.raw(
      `WITH _nc_matched AS (
        SELECT pk, rn::bigint
        FROM unnest(ARRAY(${filteredSql}))
        WITH ORDINALITY AS t(pk, rn)
      ),
      _nc_rest AS (
        SELECT ??,
          (ROW_NUMBER() OVER (ORDER BY ?? ASC)
            + COALESCE((SELECT MAX(rn) FROM _nc_matched), 0))::bigint AS rn
        FROM ??
        WHERE ?? NOT IN (SELECT pk FROM _nc_matched)
      )
      UPDATE ?? t SET ?? = _nc_all.rn
      FROM (
        SELECT * FROM _nc_matched
        UNION ALL
        SELECT * FROM _nc_rest
      ) _nc_all
      WHERE t.?? = _nc_all.pk`,
      [
        pkColumn,
        pkColumn,
        tnPath,
        pkColumn,
        tnPath,
        colName,
        pkColumn,
      ],
    );
  } else {
    const sortedQb = knex(tnPath).select(pkColumn);
    if (sorts?.length) {
      await sortV2(baseModel, sorts, sortedQb);
    }
    sortedQb.orderBy(pkColumn);

    const sortedSql = sortedQb.toQuery().replaceAll('?', '\\?');

    await knex.raw(
      `UPDATE ?? t SET ?? = s.rn
       FROM (
         SELECT pk, rn::bigint
         FROM unnest(ARRAY(${sortedSql}))
         WITH ORDINALITY AS t(pk, rn)
       ) s
       WHERE t.?? = s.pk`,
      [tnPath, colName, pkColumn],
    );
  }
}
