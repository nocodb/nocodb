import { z } from 'zod';
import type { OperationContract } from 'src/command-registry/_types';
import { MetaTable } from '~/utils/globals';
import { Model } from '~/models';
import { dateDependencyActions } from '~/decorators/trace-command-descriptions';

// ─── dateDependencyUpdate ─────────────────────────────────────────────────────

const dateDependencyUpdateSchema = z.object({
  modelId: z.string(),
  body: z.record(z.unknown()),
});

export const DateDependencyUpdateContract: OperationContract<
  typeof dateDependencyUpdateSchema
> = {
  name: 'dateDependencyUpdate',
  version: 1,
  entity: MetaTable.DATE_DEPENDENCY,
  schema: dateDependencyUpdateSchema,
  entityId: (p) => p?.modelId,
  description: dateDependencyActions.edit,
  resolveCtx: async (context, param) => {
    const table = param?.modelId
      ? await Model.get(context, param.modelId)
      : undefined;
    return { parentEntityTitle: table?.title };
  },
};

// ─── dateDependencyDelete ─────────────────────────────────────────────────────

const dateDependencyDeleteSchema = z.object({
  modelId: z.string(),
});

export const DateDependencyDeleteContract: OperationContract<
  typeof dateDependencyDeleteSchema
> = {
  name: 'dateDependencyDelete',
  version: 1,
  entity: MetaTable.DATE_DEPENDENCY,
  schema: dateDependencyDeleteSchema,
  entityId: (p) => p?.modelId,
  description: dateDependencyActions.delete,
  resolveCtx: async (context, param) => {
    const table = param?.modelId
      ? await Model.get(context, param.modelId)
      : undefined;
    return { parentEntityTitle: table?.title };
  },
};
