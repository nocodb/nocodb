import { OperationRegistry } from '~/command-registry/_registry';
import { makeReplayReq } from '~/command-registry/_replay-context';
import {
  ScriptCreateContract,
  ScriptUpdateContract,
  ScriptDeleteContract,
} from '../operations/scripts.operations';
import type { ScriptsService } from 'src/ee/services/scripts.service';

export function registerScriptHandlers(svc: ScriptsService): void {
  OperationRegistry.register(
    ScriptCreateContract,
    async (ctx, params, meta) => {
      const req = makeReplayReq(meta.originalReq, meta.createdBy);
      return svc.createScript(ctx, { ...params, req } as any);
    },
  );

  OperationRegistry.register(
    ScriptUpdateContract,
    async (ctx, params, meta) => {
      const req = makeReplayReq(meta.originalReq, meta.createdBy);
      return svc.updateScript(ctx, { ...params, req } as any);
    },
  );

  OperationRegistry.register(
    ScriptDeleteContract,
    async (ctx, params, meta) => {
      const req = makeReplayReq(meta.originalReq, meta.createdBy);
      return svc.deleteScript(ctx, { ...params, req } as any);
    },
  );
}
