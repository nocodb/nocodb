import {
  HookCreateContract,
  HookDeleteContract,
  HookUpdateContract,
} from '../operations/hooks.operations';
import type { HooksService } from '~/services/hooks.service';
import BaseTrash from '~/ee/models/BaseTrash';
import { OperationRegistry } from '~/command-registry/registry';
import {
  makeReplayReq,
  registerForward,
} from '~/command-registry/replay-context';

export function registerHookHandlers(svc: HooksService): void {
  // Custom register for hookCreate so redo of a previously-undone create
  // restores from trash rather than re-inserting. Undo of `hookCreate`
  // emits `hookDelete` which soft-deletes the row (sets `deleted: true`
  // and creates a trash entry). A naive replay of `hookCreate` would
  // collide on PK with the soft-deleted row.
  OperationRegistry.register(HookCreateContract, async (ctx, params, meta) => {
    const req = makeReplayReq(meta.originalReq, meta.createdBy);
    if (ctx.additionalContext?.is_replay && meta.entityId) {
      const trashEntry = await BaseTrash.getByResourceId(
        ctx,
        'hook',
        meta.entityId,
      );
      if (trashEntry?.id) {
        return svc.hookRestore(ctx, { hookId: meta.entityId, req });
      }
    }
    return svc.hookCreate(ctx, { ...params, req } as any);
  });

  registerForward(HookUpdateContract, (ctx, p) => svc.hookUpdate(ctx, p));
  registerForward(HookDeleteContract, (ctx, p) => svc.hookDelete(ctx, p));
}
