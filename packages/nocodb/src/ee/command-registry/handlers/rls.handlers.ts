import { OperationRegistry } from '~/command-registry/_registry';
import { makeReplayReq } from '~/command-registry/_replay-context';
import {
  RlsPolicyCreateContract,
  RlsPolicyUpdateContract,
  RlsPolicyDeleteContract,
} from '../operations/rls.operations';
import type { RlsService } from 'src/ee/services/rls.service';

export function registerRlsHandlers(svc: RlsService): void {
  OperationRegistry.register(
    RlsPolicyCreateContract,
    async (ctx, params, meta) => {
      const req = makeReplayReq(meta.originalReq, meta.createdBy);
      return svc.createPolicy(ctx, { ...params, req } as any);
    },
  );

  OperationRegistry.register(
    RlsPolicyUpdateContract,
    async (ctx, params, meta) => {
      const req = makeReplayReq(meta.originalReq, meta.createdBy);
      return svc.updatePolicy(ctx, { ...params, req } as any);
    },
  );

  OperationRegistry.register(
    RlsPolicyDeleteContract,
    async (ctx, params, meta) => {
      const req = makeReplayReq(meta.originalReq, meta.createdBy);
      return svc.deletePolicy(ctx, { ...params, req } as any);
    },
  );
}
