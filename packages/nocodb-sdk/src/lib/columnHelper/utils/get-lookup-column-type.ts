import { ColumnType, LookupType } from '~/lib/Api';
import UITypes from '~/lib/UITypes';
import { getMetaWithCompositeKey } from '~/lib/helpers/metaHelpers';

export function getLookupColumnType({
  col,
  meta,
  metas,
  baseId,
  visitedIds = new Set<string>(),
}: {
  col: ColumnType;
  meta: { columns: ColumnType[]; base_id?: string };
  metas: Record<string, any>;
  baseId?: string;
  visitedIds?: Set<string>;
}): UITypes | null | undefined {
  const currentBaseId = baseId || meta?.base_id;

  const colOptions = col.colOptions as LookupType;
  const relationColumnOptions: any = colOptions.fk_relation_column_id
    ? meta?.columns?.find((c) => c.id === colOptions.fk_relation_column_id)
        ?.colOptions
    : null;
  const relatedTableMeta =
    relationColumnOptions?.fk_related_model_id &&
    getMetaWithCompositeKey(metas, currentBaseId, relationColumnOptions.fk_related_model_id as string);

  const childColumn = relatedTableMeta?.columns.find(
    (c: ColumnType) => c.id === colOptions.fk_lookup_column_id
  ) as ColumnType | undefined;

  // if child column is lookup column, then recursively find the column type
  // and check for circular dependency
  if (
    childColumn &&
    childColumn.uidt === UITypes.Lookup &&
    !visitedIds.has(childColumn.id) &&
    relatedTableMeta?.columns
  ) {
    visitedIds.add(childColumn.id);
    return getLookupColumnType({
      col: childColumn,
      meta: relatedTableMeta as { columns: ColumnType[]; base_id?: string },
      metas: metas,
      baseId: relatedTableMeta?.base_id || baseId,
      visitedIds: visitedIds,
    });
  }

  return (childColumn?.uidt as UITypes) || null;
}
