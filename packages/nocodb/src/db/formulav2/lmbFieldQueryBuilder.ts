import {
  getLmtTrackedFieldIds,
  isAllowedLmtTrackedField,
  UITypes,
} from 'nocodb-sdk';
import type { IBaseModelSqlV2 } from '~/db/IBaseModelSqlV2';
import type Column from '~/models/Column';
import type Model from '~/models/Model';

/**
 * Builds the select expression for a LastModifiedBy column configured to
 * track specific fields: the `modifiedBy` of the most recently modified
 * tracked field, read from the row-meta JSONB column (latest
 * `modifiedTime` entry among the tracked ids wins). Returns the raw user
 * id — callers rely on the existing LastModifiedBy read expansion /
 * display-name mapping to resolve it to a user.
 *
 * PG-only, like the row-meta column itself. Degrades to NULL when no
 * valid tracked ids remain or the table has no row-meta column.
 */
export async function lmbFieldQueryBuilder({
  baseModel,
  column,
  model,
  tableAlias,
}: {
  baseModel: IBaseModelSqlV2;
  column: Column;
  model?: Model;
  tableAlias?: string;
}) {
  const context = baseModel.context;
  const refModel = model ?? baseModel.model;
  const columns = await refModel.getColumns(context);

  const metaColumn = columns.find((c) => c.uidt === UITypes.Meta);
  const trackedIds = getLmtTrackedFieldIds(column).filter((id) => {
    const tracked = columns.find((c) => c.id === id);
    return tracked && isAllowedLmtTrackedField(tracked);
  });

  if (!metaColumn || !trackedIds.length) {
    return { builder: baseModel.dbDriver.raw('NULL') };
  }

  const metaRef = `${tableAlias ?? baseModel.getTnPath(refModel.table_name)}.${
    metaColumn.column_name
  }`;

  return {
    builder: baseModel.dbDriver.raw(
      `(SELECT e.value->>'modifiedBy'
        FROM jsonb_each(COALESCE((??)::jsonb, '{}'::jsonb)) AS e
        WHERE e.key IN (${trackedIds.map(() => '?').join(',')})
          AND e.value->>'modifiedTime' IS NOT NULL
        ORDER BY (e.value->>'modifiedTime')::timestamp DESC
        LIMIT 1)`,
      [metaRef, ...trackedIds],
    ),
  };
}
