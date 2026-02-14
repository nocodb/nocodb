import type { TableType } from '~/lib/Api';

/**
 * Helper to get table metadata using composite key pattern (baseId:tableId)
 * Falls back to tableId-only lookup for backward compatibility
 *
 * @param metas - Record of table metadata keyed by composite key or tableId
 * @param baseId - Base ID for composite key lookup
 * @param tableId - Table ID to look up
 * @returns Table metadata or undefined
 */
export function getMetaWithCompositeKey(
  metas: Record<string, TableType>,
  baseId: string | undefined,
  tableId: string,
): TableType | undefined {
  if (baseId) {
    return metas[`${baseId}:${tableId}`] || metas[tableId];
  }
  return metas[tableId];
}
