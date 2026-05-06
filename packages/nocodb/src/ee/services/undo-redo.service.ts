import { Injectable, Logger } from '@nestjs/common';
import type { NcContext, NcRequest } from 'nocodb-sdk';
import { NcError } from '~/helpers/catchError';
import { OperationRegistry } from '~/command-registry/registry';
import { runInReplay } from '~/helpers/replayScope';
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

interface UndoLookupKey {
  userId: string;
  baseId: string;
  tabId: string;
}

@Injectable()
export class UndoRedoService {
  private readonly logger = new Logger(UndoRedoService.name);

  async undo(
    context: NcContext,
    param: { req: NcRequest },
  ): Promise<UndoRedoResult> {
    const key = this.resolveLookupKey(context, param.req);
    if (!key) return { status: 'empty' };

    const entry = await OperationLog.getLatestActive(context, {
      fk_user_id: key.userId,
      tab_id: key.tabId,
    });
    if (!entry) return { status: 'empty' };

    return this.dispatch(context, param.req, entry, 'undo');
  }

  async redo(
    context: NcContext,
    param: { req: NcRequest },
  ): Promise<UndoRedoResult> {
    const key = this.resolveLookupKey(context, param.req);
    if (!key) return { status: 'empty' };

    const entry = await OperationLog.getLatestUndone(context, {
      fk_user_id: key.userId,
      tab_id: key.tabId,
    });
    if (!entry) return { status: 'empty' };

    return this.dispatch(context, param.req, entry, 'redo');
  }

  async status(
    context: NcContext,
    param: { req: NcRequest },
  ): Promise<UndoRedoStatus> {
    const key = this.resolveLookupKey(context, param.req);
    if (!key) return { canUndo: false, canRedo: false };

    const [activeCount, undoneCount] = await Promise.all([
      OperationLog.countByStatus(
        context,
        { fk_user_id: key.userId, tab_id: key.tabId },
        'active',
      ),
      OperationLog.countByStatus(
        context,
        { fk_user_id: key.userId, tab_id: key.tabId },
        'undone',
      ),
    ]);

    return { canUndo: activeCount > 0, canRedo: undoneCount > 0 };
  }

  // Returns `null` when baseId/tabId missing (non-GUI callers silently
  // no-op). Missing userId is a hard failure.
  private resolveLookupKey(
    context: NcContext,
    req: NcRequest,
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

    return { userId, baseId, tabId };
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

    // Inject entity_id into the create body so model.insert preserves it
    // across undo→redo cycles (same mechanism as sandbox replay).
    const replayParams: Record<string, any> = {
      ...((params as Record<string, any> | null) ?? {}),
    };
    const idField = resolved.contract.sandbox?.id_field;
    if (
      idField &&
      entry.entity_id &&
      replayParams[idField] &&
      typeof replayParams[idField] === 'object'
    ) {
      replayParams[idField] = {
        ...replayParams[idField],
        id: entry.entity_id,
      };
    }

    let metaUpdate: Record<string, unknown> | undefined;
    try {
      const handlerResult = await runInReplay(() =>
        resolved.handler(context, replayParams as any, {
          entryId: entry.id ?? '',
          entityId: entry.entity_id,
          originalReq: req,
          createdBy: (context.user?.id ??
            (req as any)?.user?.id ??
            '') as string,
          ...(entry.meta ? { extra: entry.meta } : {}),
        }),
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
