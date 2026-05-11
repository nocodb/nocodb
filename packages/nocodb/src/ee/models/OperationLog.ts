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

const DEFAULT_RETENTION_DAYS = 7;
const RETRY_BACKOFF_MS = 60 * 60 * 1000; // 1h per cleanup-retry failure

export interface OperationLogLookupKey {
  fk_user_id: string;
  tab_id: string;
  scope_type?: OperationLogScopeType;
  scope_id?: string;
}

function buildLookupCondition(
  context: NcContext,
  key: OperationLogLookupKey,
  status: OperationLogStatus,
): Record<string, unknown> {
  const cond: Record<string, unknown> = {
    fk_user_id: key.fk_user_id,
    base_id: context.base_id,
    tab_id: key.tab_id,
    status,
  };
  if (key.scope_type) cond.scope_type = key.scope_type;
  if (key.scope_id) cond.scope_id = key.scope_id;
  return cond;
}

/**
 * Default retention: 7 days. Rows older than this have their backup columns
 * dropped and the row is deleted. Override via `NC_OP_LOG_RETENTION_DAYS`.
 */
function getRetentionMs(): number {
  const raw = process.env.NC_OP_LOG_RETENTION_DAYS;
  const days = raw ? Number(raw) : DEFAULT_RETENTION_DAYS;
  if (!Number.isFinite(days) || days <= 0) {
    return DEFAULT_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  }
  return days * 24 * 60 * 60 * 1000;
}

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
    ncMeta: MetaService = Noco.ncMeta,
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
        new Date(Date.now() + getRetentionMs()).toISOString(),
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

  public static async getLatestActive(
    context: NcContext,
    key: OperationLogLookupKey,
    ncMeta: MetaService = Noco.ncMeta,
  ): Promise<OperationLog | null> {
    // Active stack: most-recently-performed op = highest insertion seq.
    return this.getLatestByStatus(context, key, 'active', 'seq', ncMeta);
  }

  public static async getLatestUndone(
    context: NcContext,
    key: OperationLogLookupKey,
    ncMeta: MetaService = Noco.ncMeta,
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
    ncMeta: MetaService = Noco.ncMeta,
  ): Promise<number> {
    return ncMeta.metaCount(
      context.workspace_id,
      context.base_id,
      MetaTable.OPERATION_LOGS,
      {
        condition: buildLookupCondition(context, key, status),
      },
    );
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
    ncMeta: MetaService = Noco.ncMeta,
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
    ncMeta: MetaService = Noco.ncMeta,
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

  public static async discardUndoneForTab(
    context: NcContext,
    key: OperationLogLookupKey,
    ncMeta: MetaService = Noco.ncMeta,
  ): Promise<void> {
    await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.OPERATION_LOGS,
      { status: 'discarded' as OperationLogStatus },
      buildLookupCondition(context, key, 'undone' as OperationLogStatus),
    );
  }

  private static async getLatestByStatus(
    context: NcContext,
    key: OperationLogLookupKey,
    status: OperationLogStatus,
    orderField: 'seq' | 'undone_at',
    ncMeta: MetaService,
  ): Promise<OperationLog | null> {
    const rows = await ncMeta.metaList2(
      context.workspace_id,
      context.base_id,
      MetaTable.OPERATION_LOGS,
      {
        condition: buildLookupCondition(context, key, status),
        orderBy: { [orderField]: 'desc' },
        limit: 1,
      },
    );
    return rows[0] ? this.castType(rows[0]) : null;
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
