import { OperationRegistry } from '~/command-registry/_registry';
import { makeReplayReq } from '~/command-registry/_replay-context';
import {
  ExtensionCreateContract,
  ExtensionUpdateContract,
  ExtensionDeleteContract,
} from '../operations/extensions.operations';
import type { ExtensionsService } from 'src/ee/services/extensions.service';

export function registerExtensionHandlers(svc: ExtensionsService): void {
  OperationRegistry.register(
    ExtensionCreateContract,
    async (ctx, params, meta) => {
      const req = makeReplayReq(meta.originalReq, meta.createdBy);
      return svc.extensionCreate(ctx, { ...params, req } as any);
    },
  );

  OperationRegistry.register(
    ExtensionUpdateContract,
    async (ctx, params, meta) => {
      const req = makeReplayReq(meta.originalReq, meta.createdBy);
      return svc.extensionUpdate(ctx, { ...params, req } as any);
    },
  );

  OperationRegistry.register(
    ExtensionDeleteContract,
    async (ctx, params, meta) => {
      const req = makeReplayReq(meta.originalReq, meta.createdBy);
      return svc.extensionDelete(ctx, { ...params, req } as any);
    },
  );
}
