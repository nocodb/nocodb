import {
  ScriptCreateContract,
  ScriptDeleteContract,
  ScriptUpdateContract,
} from '../operations/scripts.operations';
import type { ScriptsService } from '~/services/scripts.service';
import BaseTrash from '~/ee/models/BaseTrash';
import { OperationRegistry } from '~/command-registry/registry';
import {
  makeReplayReq,
  registerForward,
} from '~/command-registry/replay-context';

export function registerScriptHandlers(svc: ScriptsService): void {
  OperationRegistry.register(
    ScriptCreateContract,
    async (ctx, params, meta) => {
      const req = makeReplayReq(meta.originalReq, meta.createdBy);
      if (ctx.additionalContext?.is_replay && meta.entityId) {
        const trashEntry = await BaseTrash.getByResourceId(
          ctx,
          'script',
          meta.entityId,
        );
        if (trashEntry?.id) {
          return svc.restoreScript(ctx, { scriptId: meta.entityId, req });
        }
      }
      return svc.createScript(ctx, { ...params, req } as any);
    },
  );

  registerForward(ScriptUpdateContract, (ctx, p) => svc.updateScript(ctx, p));
  registerForward(ScriptDeleteContract, (ctx, p) => svc.deleteScript(ctx, p));
}
