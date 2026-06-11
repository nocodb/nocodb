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
  // `column_name` is always present, and a `CAST(... AS NVARCHAR(MAX))`
  // makes them sortable regardless of the column's uidt. Handle this at
  // the orchestrator level since it's keyed on `column.dt`, not
  // `column.uidt` — the per-type handlers can't see the underlying dt
  // without each repeating the same check.
  const mssqlUnsortableDt = new Set(['text', 'ntext', 'image', 'xml']);

  for (const _sort of sortList) {
    const sort = _sort instanceof Sort ? _sort : new Sort(_sort);
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
        sanitize(knex.raw('CAST(?? AS NVARCHAR(MAX))', [column.column_name])),
        direction,
        nulls,
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
