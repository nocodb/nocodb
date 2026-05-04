import { z } from 'zod';
import type { OperationContract } from 'src/command-registry/types';
import { OperationName } from '~/command-registry/op-names';
import { MetaTable } from '~/utils/globals';

const trashRestoreSchema = z.object({
  resourceType: z.string(),
  resourceId: z.string(),
});

export const TrashRestoreContract: OperationContract<
  typeof trashRestoreSchema
> = {
  name: OperationName.trashRestore,
  version: 1,
  entity: MetaTable.TRASH,
  schema: trashRestoreSchema,
  entityId: (p) => p.resourceId,
  description: () => 'Restore from trash',
};
