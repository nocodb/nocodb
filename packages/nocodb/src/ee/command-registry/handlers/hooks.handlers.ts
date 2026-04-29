import { OperationRegistry } from '~/command-registry/_registry';
import { makeReplayReq } from '~/command-registry/_replay-context';
import {
  HookCreateContract,
  HookUpdateContract,
  HookDeleteContract,
} from '../operations/hooks.operations';
import type { HooksService } from 'src/ee/services/hooks.service';

export function registerHookHandlers(svc: HooksService): void {
  OperationRegistry.register(
    HookCreateContract,
    async (ctx, params, meta) => {
      const req = makeReplayReq(meta.originalReq, meta.createdBy);
      return svc.hookCreate(ctx, { ...params, req } as any);
    },
  );

  OperationRegistry.register(
    HookUpdateContract,
    async (ctx, params, meta) => {
      const req = makeReplayReq(meta.originalReq, meta.createdBy);
      return svc.hookUpdate(ctx, { ...params, req } as any);
    },
  );

  OperationRegistry.register(
    HookDeleteContract,
    async (ctx, params, meta) => {
      const req = makeReplayReq(meta.originalReq, meta.createdBy);
      return svc.hookDelete(ctx, { ...params, req } as any);
    },
  );
}
