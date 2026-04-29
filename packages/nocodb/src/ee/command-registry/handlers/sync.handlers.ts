import { OperationRegistry } from '~/command-registry/_registry';
import { makeReplayReq } from '~/command-registry/_replay-context';
import {
  SyncCreateContract,
  SyncUpdateContract,
  SyncDeleteContract,
} from '../operations/sync.operations';
import type { SyncService } from 'src/ee/services/sync.service';

export function registerSyncHandlers(svc: SyncService): void {
  OperationRegistry.register(
    SyncCreateContract,
    async (ctx, params, meta) => {
      const req = makeReplayReq(meta.originalReq, meta.createdBy);
      return svc.syncCreate(ctx, { ...params, req } as any);
    },
  );

  OperationRegistry.register(
    SyncUpdateContract,
    async (ctx, params, meta) => {
      const req = makeReplayReq(meta.originalReq, meta.createdBy);
      return svc.syncUpdate(ctx, { ...params, req } as any);
    },
  );

  OperationRegistry.register(
    SyncDeleteContract,
    async (ctx, params, meta) => {
      const req = makeReplayReq(meta.originalReq, meta.createdBy);
      return svc.syncDelete(ctx, { ...params, req } as any);
    },
  );
}
