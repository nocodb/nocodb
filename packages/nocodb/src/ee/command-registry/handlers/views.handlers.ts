import { OperationRegistry } from '~/command-registry/_registry';
import { makeReplayReq } from '~/command-registry/_replay-context';
import {
  ViewUpdateContract,
  ViewDeleteContract,
  ShareViewContract,
  ShareViewUpdateContract,
  ShareViewDeleteContract,
} from '../operations/views.operations';
import type { ViewsService } from 'src/ee/services/views.service';

export function registerViewHandlers(svc: ViewsService): void {
  OperationRegistry.register(
    ViewUpdateContract,
    async (ctx, params, meta) => {
      const req = makeReplayReq(meta.originalReq, meta.createdBy);
      return svc.viewUpdate(ctx, { ...params, req } as any);
    },
  );

  OperationRegistry.register(
    ViewDeleteContract,
    async (ctx, params, meta) => {
      const req = makeReplayReq(meta.originalReq, meta.createdBy);
      return svc.viewDelete(ctx, { ...params, req } as any);
    },
  );

  OperationRegistry.register(
    ShareViewContract,
    async (ctx, params, meta) => {
      const req = makeReplayReq(meta.originalReq, meta.createdBy);
      return svc.shareView(ctx, { ...params, req } as any);
    },
  );

  OperationRegistry.register(
    ShareViewUpdateContract,
    async (ctx, params, meta) => {
      const req = makeReplayReq(meta.originalReq, meta.createdBy);
      return svc.shareViewUpdate(ctx, { ...params, req } as any);
    },
  );

  OperationRegistry.register(
    ShareViewDeleteContract,
    async (ctx, params, meta) => {
      const req = makeReplayReq(meta.originalReq, meta.createdBy);
      return svc.shareViewDelete(ctx, { ...params, req } as any);
    },
  );
}
