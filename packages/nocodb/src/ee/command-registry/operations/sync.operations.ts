import { z } from 'zod';
import type { OperationContract } from 'src/command-registry/types';
import { OperationName } from '~/command-registry/op-names';
import { MetaTable } from '~/utils/globals';
import SyncSource from '~/models/SyncSource';
import { syncActions } from '~/decorators/trace-command-descriptions';

const createSchema = z.object({
  baseId: z.string(),
  sourceId: z.string().optional(),
  userId: z.string(),
  syncPayload: z.record(z.any()),
});

export const SyncCreateContract: OperationContract<typeof createSchema> = {
  name: OperationName.syncCreate,
  version: 1,
  entity: MetaTable.SYNC_SOURCE,
  schema: createSchema,
  idField: 'syncPayload',
  entityId: 'id',
  entityTitle: (p, r) => p?.syncPayload?.title ?? r?.title,
  description: syncActions.add,
};

const updateSchema = z.object({
  syncId: z.string(),
  syncPayload: z.record(z.any()),
});

export const SyncUpdateContract: OperationContract<typeof updateSchema> = {
  name: OperationName.syncUpdate,
  version: 1,
  entity: MetaTable.SYNC_SOURCE,
  schema: updateSchema,
  entityId: (p) => p.syncId,
  entityTitle: (p) => p.syncPayload?.title,
  description: syncActions.edit,
};

const deleteSchema = z.object({
  syncId: z.string(),
});

export const SyncDeleteContract: OperationContract<typeof deleteSchema> = {
  name: OperationName.syncDelete,
  version: 1,
  entity: MetaTable.SYNC_SOURCE,
  schema: deleteSchema,
  entityId: (p) => p.syncId,
  description: syncActions.delete,
  resolveCtx: async (context, param) => {
    const sync = await SyncSource.get(context, param.syncId);
    return { entityTitle: sync?.title };
  },
};
