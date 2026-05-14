import { Injectable, Logger } from '@nestjs/common';
import type { NcContext, NcRequest, OperationLogScopeType } from 'nocodb-sdk';
import { NcError } from '~/helpers/catchError';
import { OperationRegistry } from '~/command-registry/registry';
import { dispatchOperation } from '~/command-registry/replay-context';
import { MacroPartialFailureError } from '~/command-registry/operations/macro-partial-failure.error';
import { NC_DISABLE_UNDO_REDO } from '~/utils/nc-config/constants';
import { OperationLog } from '~/models';
import { isDevOrTestEnvironment } from '~/utils';

export interface UndoRedoSkip {
  reason: string;
  ref: string;
}

export type UndoRedoResult =
  | { status: 'ok'; entryId: string }
  | { status: 'empty' }
  | { status: 'no_handler'; opName: string }
  | {
      status: 'partial';
      entryId: string;
      skipped: ReadonlyArray<UndoRedoSkip>;
    }
  | {
      status: 'errored';
      code: 'dispatch_failed';
      entryId: string;
      /** Raw handler/driver message — populated only in dev/test for easier
       *  local debugging. Omitted in prod/staging to avoid leaking schema
       *  names, parameter values, or row fragments. */
      error?: string;
    }
  | {
      status: 'errored';
      code: 'macro_partial_failure';
      entryId: string;
      partial: {
        completed: number;
        total: number;
        failedChildOp: string;
        failedAtIndex: number;
      };
      error?: string;
    };

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
    if (NC_DISABLE_UNDO_REDO) return { status: 'empty' };

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
    if (NC_DISABLE_UNDO_REDO) return { status: 'empty' };

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
    const replayContext: NcContext = { ...context, socket_id: null };

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
    let skipped: ReadonlyArray<UndoRedoSkip> = [];
    try {
      const handlerResult = await dispatchOperation(
        replayContext,
        resolved.contract,
        resolved.handler,
        {
          params,
          entityId: entry.entity_id,
          extra: entry.meta as Record<string, unknown> | undefined,
          entryId: entry.id ?? '',
          createdBy: (replayContext.user?.id ??
            (req as any)?.user?.id ??
            '') as string,
          originalReq: req,
        },
        direction,
      );

      const ret = handlerResult as
        | {
            metaUpdate?: Record<string, unknown>;
            skipped?: ReadonlyArray<UndoRedoSkip>;
          }
        | undefined;
      if (ret && typeof ret === 'object') {
        if (ret.metaUpdate) metaUpdate = ret.metaUpdate;
        if (ret.skipped?.length) skipped = ret.skipped;
      }
    } catch (e: any) {
      const message = e?.message ?? String(e);
      this.logger.error(
        `Undo/redo dispatch failed for ${opName}@${opVersion}: ${message}`,
        e?.stack,
      );

      if (e instanceof MacroPartialFailureError) {
        if (entry.id) {
          await OperationLog.markStatus(replayContext, entry.id, 'errored', {
            error: message,
            meta: {
              ...((entry.meta as Record<string, any>) ?? {}),
              macroTranscript: e.partialTranscript,
              macroPartialFailure: {
                completedIndexes: e.completedIndexes,
                failedAtIndex: e.failure.index,
                failedChildOp: e.failure.childOp,
                totalChildren: e.totalChildren,
                error: e.failure.error,
              },
            },
          });
        }
        return {
          status: 'errored',
          code: 'macro_partial_failure',
          entryId: entry.id ?? '',
          partial: {
            completed: e.completedIndexes.length,
            total: e.totalChildren,
            failedChildOp: e.failure.childOp,
            failedAtIndex: e.failure.index,
          },
          ...(isDevOrTestEnvironment ? { error: message } : {}),
        };
      }

      if (entry.id) {
        await OperationLog.markStatus(replayContext, entry.id, 'errored', {
          error: message,
        });
      }
      return {
        status: 'errored',
        code: 'dispatch_failed',
        entryId: entry.id ?? '',
        ...(isDevOrTestEnvironment ? { error: message } : {}),
      };
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
        replayContext,
        entry.id,
        direction === 'undo' ? 'undone' : 'active',
        statusExtra,
      );
    }

    if (skipped.length) {
      return { status: 'partial', entryId: entry.id ?? '', skipped };
    }
    return { status: 'ok', entryId: entry.id ?? '' };
  }
}
