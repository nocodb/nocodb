import {
  ExtensionCreateContract,
  ExtensionDeleteContract,
  ExtensionUpdateContract,
} from '../operations/extensions.operations';
import type { ExtensionsService } from '~/services/extensions.service';
import BaseTrash from '~/ee/models/BaseTrash';
import { OperationRegistry } from '~/command-registry/registry';
import {
  makeReplayReq,
  registerForward,
} from '~/command-registry/replay-context';

export function registerExtensionHandlers(svc: ExtensionsService): void {
  OperationRegistry.register(
    ExtensionCreateContract,
    async (ctx, params, meta) => {
      const req = makeReplayReq(meta.originalReq, meta.createdBy);
      if (ctx.additionalContext?.is_replay && meta.entityId) {
        const trashEntry = await BaseTrash.getByResourceId(
          ctx,
          'extension',
          meta.entityId,
        );
        if (trashEntry?.id) {
          return svc.restoreExtension(ctx, {
            extensionId: meta.entityId,
            req,
          });
        }
      }
      return svc.extensionCreate(ctx, { ...params, req } as any);
    },
  );

  registerForward(ExtensionUpdateContract, (ctx, p) =>
    svc.extensionUpdate(ctx, p),
  );
  registerForward(ExtensionDeleteContract, (ctx, p) =>
    svc.extensionDelete(ctx, p),
  );
}
