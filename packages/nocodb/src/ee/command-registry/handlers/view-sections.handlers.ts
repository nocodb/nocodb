import { OperationRegistry } from '~/command-registry/_registry';
import { makeReplayReq } from '~/command-registry/_replay-context';
import {
  ViewSectionCreateContract,
  ViewSectionUpdateContract,
  ViewSectionDeleteContract,
} from '../operations/view-sections.operations';
import type { ViewSectionsService } from 'src/ee/services/view-sections.service';

export function registerViewSectionHandlers(svc: ViewSectionsService): void {
  OperationRegistry.register(
    ViewSectionCreateContract,
    async (ctx, params, meta) => {
      const req = makeReplayReq(meta.originalReq, meta.createdBy);
      return svc.viewSectionCreate(ctx, { ...params, req } as any);
    },
  );

  OperationRegistry.register(
    ViewSectionUpdateContract,
    async (ctx, params, meta) => {
      const req = makeReplayReq(meta.originalReq, meta.createdBy);
      return svc.viewSectionUpdate(ctx, { ...params, req } as any);
    },
  );

  OperationRegistry.register(
    ViewSectionDeleteContract,
    async (ctx, params, meta) => {
      const req = makeReplayReq(meta.originalReq, meta.createdBy);
      return svc.viewSectionDelete(ctx, { ...params, req } as any);
    },
  );
}
