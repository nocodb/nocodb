import { OperationRegistry } from '~/command-registry/_registry';
import { makeReplayReq } from '~/command-registry/_replay-context';
import {
  TableCreateContract,
  TableUpdateContract,
  TableDeleteContract,
} from '../operations/tables.operations';
import type { TablesService } from 'src/ee/services/tables.service';

export function registerTableHandlers(svc: TablesService): void {
  OperationRegistry.register(
    TableCreateContract,
    async (ctx, params, meta) => {
      const req = makeReplayReq(meta.originalReq, meta.createdBy);
      return svc.tableCreate(ctx, { ...params, req } as any);
    },
  );

  OperationRegistry.register(
    TableUpdateContract,
    async (ctx, params, meta) => {
      const req = makeReplayReq(meta.originalReq, meta.createdBy);
      return svc.tableUpdate(ctx, { ...params, req } as any);
    },
  );

  OperationRegistry.register(
    TableDeleteContract,
    async (ctx, params, meta) => {
      const req = makeReplayReq(meta.originalReq, meta.createdBy);
      return svc.tableDelete(ctx, { ...params, req } as any);
    },
  );
}
