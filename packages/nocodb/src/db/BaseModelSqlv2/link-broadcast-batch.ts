import { AsyncLocalStorage } from 'node:async_hooks';
import type { IBaseModelSqlV2 } from '~/db/IBaseModelSqlV2';

interface TableBatch {
  baseModel: IBaseModelSqlV2;
  ids: Set<string>;
  // null = some write changed any link
  linkColumnIds: Set<string> | null;
}

const storage = new AsyncLocalStorage<Map<string, TableBatch>>();

/**
 * Run `fn` with link broadcasts collected per table, then send one per table.
 * A nested call joins the outer batch.
 */
export async function batchLinkBroadcasts<T>(fn: () => Promise<T>): Promise<T> {
  if (storage.getStore()) return fn();

  const batch = new Map<string, TableBatch>();
  try {
    return await storage.run(batch, fn);
  } finally {
    for (const { baseModel, ids, linkColumnIds } of batch.values()) {
      await baseModel.broadcastLinkUpdates(
        [...ids],
        linkColumnIds ? [...linkColumnIds] : [],
      );
    }
  }
}

/** Add to the active batch; false when none is active. */
export function collectLinkBroadcast(
  baseModel: IBaseModelSqlV2,
  ids: Array<string>,
  linkColumnIds: string[],
): boolean {
  const batch = storage.getStore();
  if (!batch) return false;

  const tableId = baseModel.model.id;
  let entry = batch.get(tableId);
  if (!entry) {
    entry = {
      baseModel: baseModel.getNonTransactionalClone(),
      ids: new Set(),
      linkColumnIds: new Set(),
    };
    batch.set(tableId, entry);
  }

  for (const id of ids) entry.ids.add(String(id));
  if (!linkColumnIds.length) entry.linkColumnIds = null;
  else if (entry.linkColumnIds) {
    for (const id of linkColumnIds) entry.linkColumnIds.add(id);
  }
  return true;
}
