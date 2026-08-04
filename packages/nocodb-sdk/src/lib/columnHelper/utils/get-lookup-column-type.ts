import { ColumnType, LookupType } from '~/lib/Api';
import UITypes from '~/lib/UITypes';
import { getMetaWithCompositeKey } from '~/lib/helpers/metaHelpers';

/**
 * Resolve the leaf column a Lookup ultimately points at, following nested Lookup
 * chains (Lookup -> Lookup -> … -> X). Returns the first non-Lookup target column
 * (which may itself be a Formula/Rollup/etc.), or null when it cannot be resolved
 * (e.g. external base, missing meta, circular chain).
 */
export function resolveLookupLeafColumn({
  col,
  meta,
  metas,
  baseId,
  visitedIds = new Set<string>(),
}: {
  col: ColumnType;
  meta: { columns?: ColumnType[]; base_id?: string };
  metas: Record<string, any>;
  baseId?: string;
  visitedIds?: Set<string>;
}): ColumnType | null | undefined {
  const currentBaseId = baseId || meta?.base_id;

  const colOptions = col.colOptions as LookupType;
  const relationColumnOptions: any = colOptions.fk_relation_column_id
    ? meta?.columns?.find((c) => c.id === colOptions.fk_relation_column_id)
        ?.colOptions
    : null;
  const relatedTableMeta =
    relationColumnOptions?.fk_related_model_id &&
    getMetaWithCompositeKey(
      metas,
      currentBaseId,
      relationColumnOptions.fk_related_model_id as string
    );

  const childColumn = relatedTableMeta?.columns.find(
    (c: ColumnType) => c.id === colOptions.fk_lookup_column_id
  ) as ColumnType | undefined;

  // if child column is a lookup column, recurse to find the leaf column while
  // guarding against circular dependencies
  if (
    childColumn &&
    childColumn.uidt === UITypes.Lookup &&
    !visitedIds.has(childColumn.id) &&
    relatedTableMeta?.columns
  ) {
    visitedIds.add(childColumn.id);
    return resolveLookupLeafColumn({
      col: childColumn,
      meta: relatedTableMeta as { columns: ColumnType[]; base_id?: string },
      metas,
      baseId: relatedTableMeta?.base_id || baseId,
      visitedIds,
    });
  }

  return childColumn ?? null;
}

export function getLookupColumnType(params: {
  col: ColumnType;
  meta: { columns?: ColumnType[]; base_id?: string };
  metas: Record<string, any>;
  baseId?: string;
  visitedIds?: Set<string>;
}): UITypes | null | undefined {
  return (resolveLookupLeafColumn(params)?.uidt as UITypes) || null;
}
