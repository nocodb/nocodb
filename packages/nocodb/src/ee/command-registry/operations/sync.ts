import type { OperationContract } from '~/command-registry/types';
import type { SyncService } from '~/services/sync.service';
import { OperationName } from '~/command-registry/op-names';
import { registerForward } from '~/command-registry/replay-context';
import { MetaTable } from '~/utils/globals';
import SyncSource from '~/models/SyncSource';
import { syncActions } from '~/decorators/trace-command-descriptions';
import {
  syncCreateSchema,
  syncDeleteSchema,
  syncUpdateSchema,
} from '~/command-registry/operations/_schemas/sync';

export const SyncCreateContract: OperationContract<typeof syncCreateSchema> = {
  name: OperationName.syncCreate,
  entity: MetaTable.SYNC_SOURCE,
  schema: syncCreateSchema,
  entry: {
    entity_id: 'id',
    entity_title: (params, result) =>
      params?.syncPayload?.title ??
      (result as { title?: string } | undefined)?.title,
    description: syncActions.add,
  },
  sandbox: { id_field: 'syncPayload' },
};

export const SyncUpdateContract: OperationContract<typeof syncUpdateSchema> = {
  name: OperationName.syncUpdate,
  entity: MetaTable.SYNC_SOURCE,
  schema: syncUpdateSchema,
  entry: {
    entity_id: (params) => params.syncId,
    entity_title: (params) => params.syncPayload?.title,
    description: syncActions.edit,
  },
};

export const SyncDeleteContract: OperationContract<typeof syncDeleteSchema> = {
  name: OperationName.syncDelete,
  entity: MetaTable.SYNC_SOURCE,
  schema: syncDeleteSchema,
  entry: {
    entity_id: (params) => params.syncId,
    description: syncActions.delete,
    before: async (context, params) => {
      const sync = await SyncSource.get(context, params.syncId);
      return { entityTitle: sync?.title };
    },
  },
};

export function registerSyncHandlers(svc: SyncService): void {
  registerForward(SyncCreateContract, (context, params) =>
    svc.syncCreate(context, params),
  );
  registerForward(SyncUpdateContract, (context, params) =>
    svc.syncUpdate(context, params),
  );
  registerForward(SyncDeleteContract, (context, params) =>
    svc.syncDelete(context, params),
  );
}
