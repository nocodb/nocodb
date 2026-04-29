import { OperationRegistry } from '~/command-registry/_registry';
import { makeReplayReq } from '~/command-registry/_replay-context';
import {
  FilterCreateContract,
  FilterUpdateContract,
  FilterDeleteContract,
  LinkFilterCreateContract,
  WidgetFilterCreateContract,
  RlsPolicyFilterCreateContract,
  RowColorConditionsCreateContract,
} from '../operations/filters.operations';
import type { FiltersService } from 'src/ee/services/filters.service';

export function registerFilterHandlers(svc: FiltersService): void {
  OperationRegistry.register(
    FilterCreateContract,
    async (ctx, params, meta) => {
      const req = makeReplayReq(meta.originalReq, meta.createdBy);
      return svc.filterCreate(ctx, { ...params, req } as any);
    },
  );

  OperationRegistry.register(
    FilterUpdateContract,
    async (ctx, params, meta) => {
      const req = makeReplayReq(meta.originalReq, meta.createdBy);
      return svc.filterUpdate(ctx, { ...params, req } as any);
    },
  );

  OperationRegistry.register(
    FilterDeleteContract,
    async (ctx, params, meta) => {
      const req = makeReplayReq(meta.originalReq, meta.createdBy);
      return svc.filterDelete(ctx, { ...params, req } as any);
    },
  );

  OperationRegistry.register(
    LinkFilterCreateContract,
    async (ctx, params, meta) => {
      const req = makeReplayReq(meta.originalReq, meta.createdBy);
      return svc.linkFilterCreate(ctx, { ...params, req } as any);
    },
  );

  OperationRegistry.register(
    WidgetFilterCreateContract,
    async (ctx, params, meta) => {
      const req = makeReplayReq(meta.originalReq, meta.createdBy);
      return svc.widgetFilterCreate(ctx, { ...params, req } as any);
    },
  );

  OperationRegistry.register(
    RlsPolicyFilterCreateContract,
    async (ctx, params, meta) => {
      const req = makeReplayReq(meta.originalReq, meta.createdBy);
      return svc.rlsPolicyFilterCreate(ctx, { ...params, req } as any);
    },
  );

  OperationRegistry.register(
    RowColorConditionsCreateContract,
    async (ctx, params, meta) => {
      const req = makeReplayReq(meta.originalReq, meta.createdBy);
      return svc.rowColorConditionsCreate(ctx, { ...params, req } as any);
    },
  );
}
