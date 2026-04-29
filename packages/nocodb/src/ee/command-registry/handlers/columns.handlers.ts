import { OperationRegistry } from '~/command-registry/_registry';
import { makeReplayReq } from '~/command-registry/_replay-context';
import {
  ColumnAddContract,
  ColumnUpdateContract,
  ColumnDeleteContract,
} from '../operations/columns.operations';
import type { ColumnsService } from 'src/ee/services/columns.service';

export function registerColumnHandlers(svc: ColumnsService): void {
  OperationRegistry.register(
    ColumnAddContract,
    async (ctx, params, meta) => {
      const req = makeReplayReq(meta.originalReq, meta.createdBy);
      return svc.columnAdd(ctx, { ...params, req } as any);
    },
  );

  OperationRegistry.register(
    ColumnUpdateContract,
    async (ctx, params, meta) => {
      const req = makeReplayReq(meta.originalReq, meta.createdBy);
      return svc.columnUpdate(ctx, { ...params, req } as any);
    },
  );

  OperationRegistry.register(
    ColumnDeleteContract,
    async (ctx, params, meta) => {
      const req = makeReplayReq(meta.originalReq, meta.createdBy);
      return svc.columnDelete(ctx, { ...params, req } as any);
    },
  );
}
