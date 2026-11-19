import { AsyncLocalStorage } from 'node:async_hooks';
import { Logger } from '@nestjs/common';
import type { IBaseModelSqlV2 } from '~/db/IBaseModelSqlV2';

const logger = new Logger('LinkBroadcastBatch');

// Bounds the audit payloads built at once, and what one failed write loses
const AUDIT_CHUNK_SIZE = 5000;

type LinkAuditArgs = Parameters<IBaseModelSqlV2['afterAddOrRemoveChild']>;

interface TableBatch {
  baseModel: IBaseModelSqlV2;
  ids: Set<string>;
  // null = some write changed any link
  linkColumnIds: Set<string> | null;
}

interface AuditBatch {
  baseModel: IBaseModelSqlV2;
  common: LinkAuditArgs[0];
  auditObjs: LinkAuditArgs[1];
}

interface Batch {
  tables: Map<string, TableBatch>;
  audits: Map<string, AuditBatch>;
  auditWrites: Promise<void>[];
  // Timers and jobs started inside `fn` keep the store after the flush; they send directly.
  closed: boolean;
}

const storage = new AsyncLocalStorage<Batch>();

const activeBatch = () => {
  const batch = storage.getStore();
  return batch && !batch.closed ? batch : undefined;
};

const writeAudits = (
  { baseModel, common }: AuditBatch,
  auditObjs: LinkAuditArgs[1],
) =>
  // Outside the store, or the batch would collect its own write again
  storage
    .exit(() => baseModel.afterAddOrRemoveChild(common, auditObjs))
    .catch((e) => logger.error(e.message, e.stack));

/**
 * Run `fn` with link broadcasts collected per table, then send one per table.
 * Link audits are collected too and written per link field, a chunk at a time.
 * A nested call joins the outer batch.
 */
export async function batchLinkBroadcasts<T>(fn: () => Promise<T>): Promise<T> {
  if (activeBatch()) return fn();

  const batch: Batch = {
    tables: new Map(),
    audits: new Map(),
    auditWrites: [],
    closed: false,
  };
  try {
    return await storage.run(batch, fn);
  } finally {
    batch.closed = true;
    for (const { baseModel, ids, linkColumnIds } of batch.tables.values()) {
      await baseModel.broadcastLinkUpdates(
        [...ids],
        linkColumnIds ? [...linkColumnIds] : [],
      );
    }
    await Promise.all(batch.auditWrites);
    for (const entry of batch.audits.values()) {
      if (entry.auditObjs.length) await writeAudits(entry, entry.auditObjs);
    }
    // The store outlives the batch in timers started inside `fn`
    batch.audits.clear();
    batch.auditWrites = [];
  }
}

/** Add to the active batch; false when none is active. */
export function collectLinkBroadcast(
  baseModel: IBaseModelSqlV2,
  ids: Array<string>,
  linkColumnIds: string[],
): boolean {
  const batch = activeBatch();
  if (!batch) return false;

  const tableId = baseModel.model.id;
  let entry = batch.tables.get(tableId);
  if (!entry) {
    entry = {
      baseModel: baseModel.getNonTransactionalClone(),
      ids: new Set(),
      linkColumnIds: new Set(),
    };
    batch.tables.set(tableId, entry);
  }

  for (const id of ids) entry.ids.add(String(id));
  if (!linkColumnIds.length) entry.linkColumnIds = null;
  else if (entry.linkColumnIds) {
    for (const id of linkColumnIds) entry.linkColumnIds.add(id);
  }
  return true;
}

/** Add to the active batch; false when none is active or it belongs to another request. */
export function collectLinkAudit(
  baseModel: IBaseModelSqlV2,
  common: LinkAuditArgs[0],
  auditObjs: LinkAuditArgs[1],
): boolean {
  const batch = activeBatch();
  if (!batch) return false;

  const key = [
    baseModel.model.id,
    common.opType,
    common.model.id,
    common.refModel.id,
    common.columnId,
    common.refColumnId,
  ].join(':');
  let entry = batch.audits.get(key);
  if (!entry) {
    entry = {
      baseModel: baseModel.getNonTransactionalClone(),
      common,
      auditObjs: [...auditObjs],
    };
    batch.audits.set(key, entry);
  } else if (entry.common.req !== common.req) {
    return false;
  } else {
    entry.auditObjs.push(...auditObjs);
  }

  // A long batch holds, and a crash loses, at most one unwritten chunk per link field
  while (entry.auditObjs.length >= AUDIT_CHUNK_SIZE) {
    batch.auditWrites.push(
      writeAudits(entry, entry.auditObjs.splice(0, AUDIT_CHUNK_SIZE)),
    );
  }
  return true;
}
