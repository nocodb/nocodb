import { OperationRegistry } from '~/command-registry/_registry';
import { makeReplayReq } from '~/command-registry/_replay-context';
import {
  SortCreateContract,
  SortUpdateContract,
  SortDeleteContract,
  ViewColumnUpdateContract,
  VisibilityUpdateContract,
} from '../operations/sorts-visibilities.operations';
import type { SortsService } from 'src/ee/services/sorts.service';
import type { ViewColumnsService } from 'src/ee/services/view-columns.service';
import type { ModelVisibilitiesService } from 'src/ee/services/model-visibilities.service';

export function registerSortHandlers(svc: SortsService): void {
  OperationRegistry.register(
    SortCreateContract,
    async (ctx, params, meta) => {
      const req = makeReplayReq(meta.originalReq, meta.createdBy);
      return svc.sortCreate(ctx, { ...params, req } as any);
    },
  );

  OperationRegistry.register(
    SortUpdateContract,
    async (ctx, params, meta) => {
      const req = makeReplayReq(meta.originalReq, meta.createdBy);
      return svc.sortUpdate(ctx, { ...params, req } as any);
    },
  );

  OperationRegistry.register(
    SortDeleteContract,
    async (ctx, params, meta) => {
      const req = makeReplayReq(meta.originalReq, meta.createdBy);
      return svc.sortDelete(ctx, { ...params, req } as any);
    },
  );
}

export function registerViewColumnHandlers(svc: ViewColumnsService): void {
  OperationRegistry.register(
    ViewColumnUpdateContract,
    async (ctx, params, meta) => {
      const req = makeReplayReq(meta.originalReq, meta.createdBy);
      return svc.columnUpdate(ctx, { ...params, req } as any);
    },
  );
}

export function registerVisibilityHandlers(
  svc: ModelVisibilitiesService,
): void {
  OperationRegistry.register(
    VisibilityUpdateContract,
    async (ctx, params, meta) => {
      const req = makeReplayReq(meta.originalReq, meta.createdBy);
      return svc.xcVisibilityMetaSetAll(ctx, { ...params, req } as any);
    },
  );
}
