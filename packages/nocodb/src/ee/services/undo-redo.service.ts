import { Injectable, Logger } from '@nestjs/common';
import type { NcContext, NcRequest } from 'nocodb-sdk';
import { NcError } from '~/helpers/catchError';
import { OperationRegistry } from '~/command-registry/registry';
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

  /**
   * Surface for the GUI Cmd-Z indicator: which sides are populated for the
   * current (user, base, tab)?
   */
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

  /**
   * Resolve `(userId, baseId, tabId)` from the request context. Returns
   * `null` when `baseId` or `tabId` is missing — the caller treats that as
   * "nothing to undo" so non-GUI callers (API tokens, internal jobs) silently
   * no-op. Missing `userId` is a hard failure since every authenticated call
   * must have a user.
   */
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

  /**
   * Resolve the op (forward for redo, inverse for undo) via the
   * OperationRegistry, dispatch it, then flip the row's status.
   *
   * Errors mark the row 'errored' and surface to the caller — the entry is
   * preserved for inspection.
   */
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

    // Inject the original entity id into params via `contract.idField` so
    // re-creates land on the same row id — same trick as
    // `SandboxCommandReplayService.replayCommand`. Combined with the
    // `is_replay` context flag below, this makes Sort.insert (and other
    // models that honor `is_replay`) preserve the pre-set id, keeping
    // inverse_params valid across undo→redo cycles.
    const replayParams: Record<string, any> = {
      ...((params as Record<string, any> | null) ?? {}),
    };
    if (
      resolved.contract.idField &&
      entry.entity_id &&
      replayParams[resolved.contract.idField] &&
      typeof replayParams[resolved.contract.idField] === 'object'
    ) {
      replayParams[resolved.contract.idField] = {
        ...replayParams[resolved.contract.idField],
        id: entry.entity_id,
      };
    }

    // Mark context as replay — Sort.insert / Hook.insert / etc. honor a
    // pre-set id only when this flag is set. Also bypasses sandbox guards.
    const replayContext: NcContext = {
      ...context,
      additionalContext: {
        ...context.additionalContext,
        is_replay: true,
      },
    };

    try {
      // `__isReplay` on req tells `recordCommand` to skip writing a new
      // operation log entry — we manage the stack here.
      const replayReq = { ...req, __isReplay: true } as NcRequest;

      await resolved.handler(replayContext, replayParams as any, {
        entryId: entry.id ?? '',
        entityId: entry.entity_id,
        originalReq: replayReq,
        createdBy: (context.user?.id ?? (req as any)?.user?.id ?? '') as string,
      });
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
      // Redo flips back to 'active' so a subsequent Cmd-Z can target it
      // again. We lose the 'redone' audit distinction, but the alternative
      // requires a query that ORs ('active', 'redone'), and the simple
      // model is good enough for the MVP. Revisit if we need audit fidelity.
      await OperationLog.markStatus(
        context,
        entry.id,
        direction === 'undo' ? 'undone' : 'active',
        direction === 'undo' ? { undone_at: new Date().toISOString() } : {},
      );
    }

    return { status: 'ok', entryId: entry.id ?? '' };
  }
}
