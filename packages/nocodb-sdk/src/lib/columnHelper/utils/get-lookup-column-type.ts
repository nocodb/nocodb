import { ColumnType, LookupType } from '~/lib/Api';
import UITypes from '~/lib/UITypes';

export function getLookupColumnType({
  col,
  meta,
  metas,
  visitedIds = new Set<string>(),
}: {
  col: ColumnType;
  meta: { columns: ColumnType[] };
  metas: Record<string, any>;
  visitedIds?: Set<string>;
}): UITypes | null | undefined {
  const colOptions = col.colOptions as LookupType;
  const relationColumnOptions: any = colOptions.fk_relation_column_id
    ? meta?.columns?.find((c) => c.id === colOptions.fk_relation_column_id)
        ?.colOptions
    : null;
  const relatedTableMeta =
    relationColumnOptions?.fk_related_model_id &&
    metas?.[relationColumnOptions.fk_related_model_id as string];

  const childColumn = relatedTableMeta?.columns.find(
    (c: ColumnType) => c.id === colOptions.fk_lookup_column_id
  ) as ColumnType | undefined;

  // if child column is lookup column, then recursively find the column type
  // and check for circular dependency
  if (
    childColumn &&
    childColumn.uidt === UITypes.Lookup &&
    !visitedIds.has(childColumn.id)
  ) {
    visitedIds.add(childColumn.id);
    return getLookupColumnType({
      col: childColumn,
      meta: relatedTableMeta,
      metas: metas,
      visitedIds: visitedIds,
    });
  }

  return (childColumn?.uidt as UITypes) || null;
}
