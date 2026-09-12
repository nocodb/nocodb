import type { Knex } from 'knex';
import type { IBaseModelSqlV2 } from '~/db/IBaseModelSqlV2';
import { FieldHandler } from '~/db/field-handler';
import { Sort } from '~/models';
import { NcError } from '~/helpers/catchError';
import { sanitize } from '~/helpers/sqlSanitize';
import { getRefColumnIfAlias } from '~/helpers';

export default async function sortV2(
  baseModelSqlv2: IBaseModelSqlV2,
  sortList: Sort[],
  qb: Knex.QueryBuilder,
  alias?: string,
  throwErrorIfInvalid = false,
) {
  if (!sortList?.length) return;

  const knex = baseModelSqlv2.dbDriver;
  const context = baseModelSqlv2.context;
  const fieldHandler = FieldHandler.fromBaseModel(baseModelSqlv2);

  // T-SQL refuses to ORDER BY columns of `text`, `ntext`, `image`, or `xml`
  // (LOB / deprecated types). They only back leaf string columns where
  // `column_name` is always present, and a `CAST(... AS NVARCHAR(n))`
  // makes them sortable regardless of the column's uidt. Handle this at
  // the orchestrator level since it's keyed on `column.dt`, not
  // `column.uidt` — the per-type handlers can't see the underlying dt
  // without each repeating the same check.
  const mssqlUnsortableDt = new Set(['text', 'ntext', 'image', 'xml']);

  // Cast to a *bounded* NVARCHAR, not NVARCHAR(MAX). A MAX/LOB sort key is
  // still unsortable in-memory: SQL Server over-estimates its size, gets a
  // capped memory grant and spills the sort to tempdb (seconds, not ms).
  // 4000 NVARCHAR chars = 8000 bytes, the widest bound that fits a sort key.
  // Trade-off: rows sharing a 4000-char prefix sort in an undefined order
  // amongst themselves — acceptable for a sort key on these rare LOB types.
  const MSSQL_SORT_KEY_WIDTH = 4000;

  // Oracle refuses LOB columns as comparison keys (ORA-22848) — and
  // LongText / JSON / Attachment all store as CLOB there. Sort on the first
  // 2000 chars via DBMS_LOB.SUBSTR, which returns VARCHAR2 for CLOB and
  // NVARCHAR2 for NCLOB (both sortable, and well under the 4000-byte
  // VARCHAR2 cap for multi-byte content).
  const oracleUnsortableDt = new Set(['clob', 'nclob']);

  for (const _sort of sortList) {
    const sort = _sort instanceof Sort ? _sort : new Sort(_sort);

    // skip disabled sorts (enabled === false or enabled === 0)
    if (sort.enabled === false || (sort.enabled as any) === 0) continue;

    const column = await getRefColumnIfAlias(
      context,
      await sort.getColumn(context),
    );

    if (!column) {
      if (throwErrorIfInvalid) {
        NcError.get(context).fieldNotFound(sort.fk_column_id);
      }
      continue;
    }

    const direction: 'asc' | 'desc' =
      sort.direction === 'desc' ? 'desc' : 'asc';
    const nulls = sort.direction === 'desc' ? 'LAST' : 'FIRST';

    if (
      baseModelSqlv2.isMssql &&
      mssqlUnsortableDt.has((column.dt ?? '').toLowerCase())
    ) {
      qb.orderBy(
        sanitize(
          knex.raw(`CAST(?? AS NVARCHAR(${MSSQL_SORT_KEY_WIDTH}))`, [
            column.column_name,
          ]),
        ),
        direction,
        nulls,
      );
      continue;
    }

    if (
      baseModelSqlv2.isOracle &&
      oracleUnsortableDt.has((column.dt ?? '').toLowerCase())
    ) {
      qb.orderByRaw(
        sanitize(
          knex.raw(`DBMS_LOB.SUBSTR(??, 2000, 1) ${direction} NULLS ${nulls}`, [
            column.column_name,
          ]),
        ),
      );
      continue;
    }

    await fieldHandler.applySort(qb, column, direction, {
      alias,
      nulls,
      context,
      knex,
      baseModel: baseModelSqlv2,
    });
  }
}
