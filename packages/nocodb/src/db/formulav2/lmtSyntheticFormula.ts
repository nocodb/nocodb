import {
  getLmtTrackedFieldIds,
  isAllowedLmtTrackedField,
  UITypes,
} from 'nocodb-sdk';
import type Column from '~/models/Column';

/**
 * Synthesizes the formula equivalent of a LastModifiedTime column that
 * tracks specific fields: `LAST_MODIFIED_TIME({colId1}, {colId2}, …)`.
 *
 * Tracked ids whose column was deleted or converted to a non-trackable type
 * are skipped. Returns null when nothing valid remains or when the table has
 * no row-meta column (non EE+PG table) — callers must then emit NULL rather
 * than fall back to record-level `updated_at`, which would surface edits to
 * untracked fields.
 */
export function getLmtSyntheticFormula(
  column: Column,
  columns: Column[],
): string | null {
  const metaColumn = columns.find((c) => c.uidt === UITypes.Meta);
  const trackedIds = getLmtTrackedFieldIds(column).filter((id) => {
    const tracked = columns.find((c) => c.id === id);
    return tracked && isAllowedLmtTrackedField(tracked);
  });

  if (!metaColumn || !trackedIds.length) return null;

  return `LAST_MODIFIED_TIME(${trackedIds.map((id) => `{${id}}`).join(',')})`;
}
