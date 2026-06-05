import type {
  NcContext,
  OperationLogScopeType,
  OperationLogStatus,
  OperationLogType,
} from 'nocodb-sdk';
import type { MetaService } from '~/meta/meta.service';
import { extractProps } from '~/helpers/extractProps';
import { prepareForDb, prepareForResponse } from '~/utils/modelUtils';
import Noco from '~/Noco';
import { MetaTable } from '~/utils/globals';

const DEFAULT_RETENTION_DAYS = 2;
const RETRY_BACKOFF_MS = 60 * 60 * 1000; // 1h per cleanup-retry failure

export interface OperationLogScopeRef {
  type: OperationLogScopeType;
  id: string;
}

/**
 * Hierarchical visibility: the leaf scope sees itself + every parent up
 * to BASE, leaf-first. Inside view V on table T: `[VIEW(V), TABLE(T),
 * BASE]`. Query is `(scope_type, scope_id) IN (these)` + order by
 * seq DESC, so the most-recent op across the visible chain wins.
 */
export interface OperationLogLookupKey {
  fk_user_id: string;
  tab_id: string;
  scopes: ReadonlyArray<OperationLogScopeRef>;
}

function applyBaseConditions(
  qb: any,
  context: NcContext,
  key: OperationLogLookupKey,
  status: OperationLogStatus,
): void {
  qb.where({
    base_id: context.base_id,
    fk_user_id: key.fk_user_id,
    tab_id: key.tab_id,
    status,
  });
  if (context.workspace_id) qb.where('fk_workspace_id', context.workspace_id);
  qb.where(function () {
    for (const s of key.scopes) {
      this.orWhere(function () {
        this.where('scope_type', s.type).andWhere('scope_id', s.id);
      });
    }
  });
}

/**
 * Default retention: 2 days from last undo/redo activity in the scope
 * (sliding window — see `bumpRetentionForScope`). Rows older than this
 * have their backup columns dropped and the row is deleted. Override
 * via `NC_OP_LOG_RETENTION_DAYS`.
 */
const RETENTION_MS: number = (() => {
  const raw = process.env.NC_OP_LOG_RETENTION_DAYS;
  const days = raw ? Number(raw) : DEFAULT_RETENTION_DAYS;
  const effectiveDays =
    Number.isFinite(days) && days > 0 ? days : DEFAULT_RETENTION_DAYS;
  return effectiveDays * 24 * 60 * 60 * 1000;
})();

export default class OperationLog implements OperationLogType {
  id?: string;
  seq?: number;
  fk_workspace_id?: string;
  base_id?: string;
  fk_user_id?: string;
  tab_id?: string;
  forward_op?: string;
  forward_op_version?: number;
  forward_params?: string;
  inverse_op?: string;
  inverse_op_version?: number;
  inverse_params?: string;
  entity_type?: string;
  entity_id?: string;
  entity_title?: string;
  description?: string;
  /** Partition this row belongs to in the undo stack. Resolved at
   *  forward record time by the contract. */
  scope_type?: OperationLogScopeType;
  scope_id?: string;
  status?: OperationLogStatus;
  error?: string;
  undone_at?: string | null;
  meta?: Record<string, any>;
  cleanup_due_at?: string | null;
  created_at?: string;
  updated_at?: string;

  constructor(data: Partial<OperationLog>) {
    Object.assign(this, data);
  }

  public static async insert(
    context: NcContext,
    input,
    ncMeta: MetaService = Noco.ncOperationLogs,
  ): Promise<OperationLog> {
    let insertData = extractProps(input, [
      'fk_user_id',
      'tab_id',
      'forward_op',
      'forward_op_version',
      'inverse_op',
      'inverse_op_version',
      'entity_type',
      'entity_id',
      'entity_title',
      'description',
      'scope_type',
      'scope_id',
      'forward_params',
      'inverse_params',
      'meta',
      'cleanup_due_at',
    ]);

    insertData = {
      ...insertData,
      seq: Date.now(),
      forward_op_version: input.forward_op_version ?? 1,
      inverse_op_version: input.inverse_op_version ?? 1,
      status: 'active',
      cleanup_due_at:
        input.cleanup_due_at ??
        new Date(Date.now() + RETENTION_MS).toISOString(),
    };

    insertData = prepareForDb(insertData, [
      'forward_params',
      'inverse_params',
      'meta',
    ]);

    const row = await ncMeta.metaInsert2(
      context.workspace_id,
      context.base_id,
      MetaTable.OPERATION_LOGS,
      insertData,
    );

    return this.castType(row);
  }

  // Satellite cleanup (NC_OP_LOG_DB). Runs on its own connection, so it is NOT
  // part of the caller's meta transaction — best-effort on base hard-delete.
  public static async deleteByBaseId(
    context: NcContext,
    baseId: string,
    ncMeta: MetaService = Noco.ncOperationLogs,
  ) {
    await ncMeta.metaDelete(
      context.workspace_id,
      context.base_id,
      MetaTable.OPERATION_LOGS,
      {
        base_id: baseId,
      },
    );
  }

  public static async getLatestActive(
    context: NcContext,
    key: OperationLogLookupKey,
    ncMeta: MetaService = Noco.ncOperationLogs,
  ): Promise<OperationLog | null> {
    // Active stack: most-recently-performed op = highest insertion seq.
    return this.getLatestByStatus(context, key, 'active', 'seq', ncMeta);
  }

  public static async getLatestUndone(
    context: NcContext,
    key: OperationLogLookupKey,
    ncMeta: MetaService = Noco.ncOperationLogs,
  ): Promise<OperationLog | null> {
    // Undone stack: most-recently-undone op = greatest `undone_at`. Ordering
    // by `seq` here would let redo pick a later op whose dependencies are
    // still undone (e.g. redo an update on a condition whose creating add
    // is still undone — the update would silently no-op against a missing
    // row, leaving the log out of sync with the actual DB).
    return this.getLatestByStatus(context, key, 'undone', 'undone_at', ncMeta);
  }

  public static async countByStatus(
    context: NcContext,
    key: OperationLogLookupKey,
    status: OperationLogStatus,
    ncMeta: MetaService = Noco.ncOperationLogs,
  ): Promise<number> {
    if (!key.scopes.length) return 0;
    const qb = ncMeta.knex(MetaTable.OPERATION_LOGS);
    applyBaseConditions(qb, context, key, status);
    const row = (await qb.count({ count: '*' }).first()) as
      | { count: string | number }
      | undefined;
    return Number(row?.count ?? 0);
  }

  public static async markStatus(
    context: NcContext,
    id: string,
    status: OperationLogStatus,
    extra: {
      error?: string;
      undone_at?: Date | string | null;
      meta?: Record<string, any>;
    } = {},
    ncMeta: MetaService = Noco.ncOperationLogs,
  ): Promise<void> {
    let updateObj = extractProps({ status, ...extra }, [
      'status',
      'error',
      'undone_at',
      'meta',
    ]);
    updateObj = prepareForDb(updateObj, ['meta']);
    await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.OPERATION_LOGS,
      updateObj,
      id,
    );
  }

  /**
   * Push the row's cleanup retry forward by `RETRY_BACKOFF_MS`. Used by the
   * cleanup processor when the per-row cleanup throws — keeps a poisoned row from
   * burning the per-tick budget on every sweep.
   */
  public static async bumpCleanupDueAt(
    context: NcContext,
    id: string,
    ncMeta: MetaService = Noco.ncOperationLogs,
  ): Promise<void> {
    const next = new Date(Date.now() + RETRY_BACKOFF_MS).toISOString();
    await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.OPERATION_LOGS,
      { cleanup_due_at: next },
      id,
    );
  }

  public static async bumpRetentionForScope(
    context: NcContext,
    key: OperationLogLookupKey,
    ncMeta: MetaService = Noco.ncOperationLogs,
  ): Promise<void> {
    if (!key.scopes.length) return;
    const nextDue = new Date(Date.now() + RETENTION_MS).toISOString();
    const qb = ncMeta.knex(MetaTable.OPERATION_LOGS);
    qb.where({
      base_id: context.base_id,
      fk_user_id: key.fk_user_id,
      tab_id: key.tab_id,
    });
    if (context.workspace_id) qb.where('fk_workspace_id', context.workspace_id);
    qb.whereNot('status', 'discarded');
    qb.where(function () {
      for (const s of key.scopes) {
        this.orWhere(function () {
          this.where('scope_type', s.type).andWhere('scope_id', s.id);
        });
      }
    });
    await qb.update({ cleanup_due_at: nextDue });
  }

  public static async discardUndoneForTab(
    context: NcContext,
    key: OperationLogLookupKey,
    ncMeta: MetaService = Noco.ncOperationLogs,
  ): Promise<void> {
    if (!key.scopes.length) return;
    const qb = ncMeta.knex(MetaTable.OPERATION_LOGS);
    applyBaseConditions(qb, context, key, 'undone' as OperationLogStatus);
    await qb.update({ status: 'discarded' as OperationLogStatus });
  }

  private static async getLatestByStatus(
    context: NcContext,
    key: OperationLogLookupKey,
    status: OperationLogStatus,
    orderField: 'seq' | 'undone_at',
    ncMeta: MetaService,
  ): Promise<OperationLog | null> {
    if (!key.scopes.length) return null;
    const qb = ncMeta.knex(MetaTable.OPERATION_LOGS);
    applyBaseConditions(qb, context, key, status);
    const row = await qb.orderBy(orderField, 'desc').first();
    return row ? this.castType(row) : null;
  }

  public static castType(row: any): OperationLog {
    if (!row) return null as any;
    const prepared = prepareForResponse(row, [
      'forward_params',
      'inverse_params',
      'meta',
    ]);
    return new OperationLog(prepared);
  }
}
