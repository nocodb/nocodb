import type { OperationContract } from '~/command-registry/types';
import type { BaseTrashService } from '~/ee/services/base-trash/base-trash.service';
import { OperationName } from '~/command-registry/op-names';
import { OperationRegistry } from '~/command-registry/registry';
import { MetaTable } from '~/utils/globals';
import BaseTrash from '~/ee/models/BaseTrash';
import { trashRestoreSchema } from '~/command-registry/operations/_schemas/trash';

export const TrashRestoreContract: OperationContract<
  typeof trashRestoreSchema
> = {
  name: OperationName.trashRestore,
  entity: MetaTable.TRASH,
  schema: trashRestoreSchema,
  entry: {
    entity_id: (params) => params.resourceId,
    description: () => 'Restore from trash',
  },
};

export function registerTrashHandlers(svc: BaseTrashService): void {
  OperationRegistry.register(
    TrashRestoreContract,
    async (context, params, meta) => {
      const trashEntry = await BaseTrash.getByResourceId(
        context,
        params.resourceType,
        params.resourceId,
      );
      if (!trashEntry?.id) return;
      return svc.restore(context, {
        trashId: trashEntry.id,
        user: meta.originalReq?.user ?? { id: meta.createdBy },
        req: meta.originalReq,
      });
    },
  );
}
