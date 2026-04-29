import { OperationRegistry } from '~/command-registry/_registry';
import { makeReplayReq } from '~/command-registry/_replay-context';
import {
  BaseVariableCreateContract,
  BaseVariableUpdateContract,
  BaseVariableDeleteContract,
} from '../operations/base-variables.operations';
import type { BaseVariablesService } from 'src/ee/services/base-variables.service';

export function registerBaseVariableHandlers(svc: BaseVariablesService): void {
  OperationRegistry.register(
    BaseVariableCreateContract,
    async (ctx, params, meta) => {
      const req = makeReplayReq(meta.originalReq, meta.createdBy);
      return svc.create(ctx, { ...params, req } as any);
    },
  );

  OperationRegistry.register(
    BaseVariableUpdateContract,
    async (ctx, params, meta) => {
      const req = makeReplayReq(meta.originalReq, meta.createdBy);
      return svc.update(ctx, { ...params, req } as any);
    },
  );

  OperationRegistry.register(
    BaseVariableDeleteContract,
    async (ctx, params, meta) => {
      const req = makeReplayReq(meta.originalReq, meta.createdBy);
      return svc.delete(ctx, { ...params, req } as any);
    },
  );
}
