import { OperationRegistry } from '~/command-registry/_registry';
import { makeReplayReq } from '~/command-registry/_replay-context';
import {
  DateDependencyUpdateContract,
  DateDependencyDeleteContract,
} from '../operations/date-dependency.operations';
import type { DateDependencyService } from 'src/ee/services/date-dependency.service';

export function registerDateDependencyHandlers(svc: DateDependencyService): void {
  OperationRegistry.register(
    DateDependencyUpdateContract,
    async (ctx, params, meta) => {
      const req = makeReplayReq(meta.originalReq, meta.createdBy);
      return svc.update(ctx, { ...params, req } as any);
    },
  );

  OperationRegistry.register(
    DateDependencyDeleteContract,
    async (ctx, params, meta) => {
      const req = makeReplayReq(meta.originalReq, meta.createdBy);
      return svc.delete(ctx, { ...params, req } as any);
    },
  );
}
