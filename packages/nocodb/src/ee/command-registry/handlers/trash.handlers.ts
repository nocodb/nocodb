import { TrashRestoreContract } from '../operations/trash.operations';
import type { BaseTrashService } from '~/ee/services/base-trash/base-trash.service';
import BaseTrash from '~/ee/models/BaseTrash';
import { OperationRegistry } from '~/command-registry/registry';

export function registerTrashHandlers(svc: BaseTrashService): void {
  OperationRegistry.register(
    TrashRestoreContract,
    async (ctx, params, meta) => {
      const trashEntry = await BaseTrash.getByResourceId(
        ctx,
        params.resourceType,
        params.resourceId,
      );
      if (!trashEntry?.id) return;
      return svc.restore(ctx, {
        trashId: trashEntry.id,
        user: meta.originalReq?.user ?? { id: meta.createdBy },
        req: meta.originalReq,
      });
    },
  );
}
