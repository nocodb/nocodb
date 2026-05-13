import { Injectable, Logger } from '@nestjs/common';
import type { NcContext, NcRequest, OperationLogScopeType } from 'nocodb-sdk';
import { NcError } from '~/helpers/catchError';
import { OperationRegistry } from '~/command-registry/registry';
import { dispatchOperation } from '~/command-registry/replay-context';
import { OperationLog } from '~/models';

export type UndoRedoResult =
  | { status: 'ok'; entryId: string }
  | { status: 'empty' }
  | { status: 'no_handler'; opName: string }
  | { status: 'errored'; error: string };

export interface UndoRedoStatus {
  canUndo: boolean;
  canRedo: boolean;
}

export interface UndoRedoScope {
  type: OperationLogScopeType;
  id: string;
}

interface UndoLookupKey {
  userId: string;
  baseId: string;
  tabId: string;
  scopes: ReadonlyArray<UndoRedoScope>;
}

@Injectable()
export class UndoRedoService {
  private readonly logger = new Logger(UndoRedoService.name);

  async undo(
    context: NcContext,
    param: { req: NcRequest; scopes?: ReadonlyArray<UndoRedoScope> },
  ): Promise<UndoRedoResult> {
    const key = this.resolveLookupKey(context, param.req, param.scopes);
    if (!key) return { status: 'empty' };

    const lookupKey = {
      fk_user_id: key.userId,
      tab_id: key.tabId,
      scopes: key.scopes,
    };

    const entry = await OperationLog.getLatestActive(context, lookupKey);
    if (!entry) return { status: 'empty' };

    // Sliding-window retention: bumps cleanup_due_at for the whole visible
    // stack so the cleanup tick can't race the dispatch and so an actively-
    // walked undo chain stays alive.
    await OperationLog.bumpRetentionForScope(context, lookupKey);

    return this.dispatch(context, param.req, entry, 'undo');
  }

  async redo(
    context: NcContext,
    param: { req: NcRequest; scopes?: ReadonlyArray<UndoRedoScope> },
  ): Promise<UndoRedoResult> {
    const key = this.resolveLookupKey(context, param.req, param.scopes);
    if (!key) return { status: 'empty' };

    const lookupKey = {
      fk_user_id: key.userId,
      tab_id: key.tabId,
      scopes: key.scopes,
    };

    const entry = await OperationLog.getLatestUndone(context, lookupKey);
    if (!entry) return { status: 'empty' };

    await OperationLog.bumpRetentionForScope(context, lookupKey);

    return this.dispatch(context, param.req, entry, 'redo');
  }

  async status(
    context: NcContext,
    param: { req: NcRequest; scopes?: ReadonlyArray<UndoRedoScope> },
  ): Promise<UndoRedoStatus> {
    const key = this.resolveLookupKey(context, param.req, param.scopes);
    if (!key) return { canUndo: false, canRedo: false };

    const [activeCount, undoneCount] = await Promise.all([
      OperationLog.countByStatus(
        context,
        { fk_user_id: key.userId, tab_id: key.tabId, scopes: key.scopes },
        'active',
      ),
      OperationLog.countByStatus(
        context,
        { fk_user_id: key.userId, tab_id: key.tabId, scopes: key.scopes },
        'undone',
      ),
    ]);

    return { canUndo: activeCount > 0, canRedo: undoneCount > 0 };
  }

  private resolveLookupKey(
    context: NcContext,
    req: NcRequest,
    scopes: ReadonlyArray<UndoRedoScope> | undefined,
  ): UndoLookupKey | null {
    const userId = context.user?.id ?? (req as any)?.user?.id;
    if (!userId) {
      NcError.get(context).forbidden(
        'Undo/redo requires an authenticated user',
      );
    }

    const baseId = context.base_id;
    const tabId = context.tab_id ?? (req as any)?.ncTabId;
    if (!baseId || !tabId) return null;

    // Frontend ships the leaf-first chain on every call. Older clients
    // that haven't been updated yet quietly no-op rather than 4xx-ing.
    if (!scopes?.length) return null;
    for (const s of scopes) {
      if (!s?.type || !s?.id) return null;
    }

    return { userId, baseId, tabId, scopes };
  }

  // Errors mark the row 'errored' and surface to the caller; the entry is
  // preserved for inspection.
  private async dispatch(
    context: NcContext,
    req: NcRequest,
    entry: OperationLog,
    direction: 'undo' | 'redo',
  ): Promise<UndoRedoResult> {
    delete context.socket_id;

    const opName = direction === 'undo' ? entry.inverse_op : entry.forward_op;
    const opVersion =
      (direction === 'undo'
        ? entry.inverse_op_version
        : entry.forward_op_version) ?? 1;
    const params =
      (direction === 'undo' ? entry.inverse_params : entry.forward_params) ??
      {};

    if (!opName) return { status: 'no_handler', opName: opName ?? 'unknown' };

    const resolved = OperationRegistry.resolve(opName, opVersion);
    if (!resolved) return { status: 'no_handler', opName };

    let metaUpdate: Record<string, unknown> | undefined;
    try {
      const handlerResult = await dispatchOperation(
        context,
        resolved.contract,
        resolved.handler,
        {
          params,
          entityId: entry.entity_id,
          extra: entry.meta as Record<string, unknown> | undefined,
          entryId: entry.id ?? '',
          createdBy: (context.user?.id ??
            (req as any)?.user?.id ??
            '') as string,
          originalReq: req,
        },
      );

      // `columnUpdate` returns `{ metaUpdate }` when its backup ref was
      // consumed and a new sibling was created for the opposite direction.
      const ret = handlerResult as
        | { metaUpdate?: Record<string, unknown> }
        | undefined;
      if (ret && typeof ret === 'object' && ret.metaUpdate) {
        metaUpdate = ret.metaUpdate;
      }
    } catch (e: any) {
      const message = e?.message ?? String(e);
      this.logger.error(
        `Undo/redo dispatch failed for ${opName}@${opVersion}: ${message}`,
        e?.stack,
      );
      if (entry.id) {
        await OperationLog.markStatus(context, entry.id, 'errored', {
          error: message,
        });
      }
      return { status: 'errored', error: message };
    }

    if (entry.id) {
      // Redo flips back to 'active' so subsequent Cmd-Z can target it again.
      const statusExtra: {
        error?: string;
        undone_at?: Date | string | null;
        meta?: Record<string, any>;
      } = direction === 'undo' ? { undone_at: new Date().toISOString() } : {};
      if (metaUpdate) {
        statusExtra.meta = { ...(entry.meta ?? {}), ...metaUpdate };
      }
      await OperationLog.markStatus(
        context,
        entry.id,
        direction === 'undo' ? 'undone' : 'active',
        statusExtra,
      );
    }

    return { status: 'ok', entryId: entry.id ?? '' };
  }
}
