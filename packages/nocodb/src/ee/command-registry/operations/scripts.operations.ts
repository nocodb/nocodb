import { z } from 'zod';
import type { OperationContract } from 'src/command-registry/_types';
import { OperationName } from '~/command-registry/_op-names';
import { MetaTable } from '~/utils/globals';
import { Script } from '~/models';
import { scriptActions } from '~/decorators/trace-command-descriptions';

const scriptBodySchema = z
  .object({
    title: z.string().optional(),
    script: z.string().optional(),
    description: z.string().optional(),
    meta: z.record(z.any()).optional(),
  })
  .passthrough();

const createSchema = z.object({
  body: scriptBodySchema,
});

export const ScriptCreateContract: OperationContract<typeof createSchema> = {
  name: OperationName.scriptCreate,
  version: 1,
  entity: MetaTable.AUTOMATIONS,
  schema: createSchema,
  idField: 'body',
  entityId: 'id',
  entityTitle: 'title',
  description: scriptActions.add,
};

const updateSchema = z.object({
  scriptId: z.string(),
  body: z
    .object({
      title: z.string().optional(),
    })
    .passthrough()
    .optional(),
});

export const ScriptUpdateContract: OperationContract<typeof updateSchema> = {
  name: OperationName.scriptUpdate,
  version: 1,
  entity: MetaTable.AUTOMATIONS,
  schema: updateSchema,
  entityId: (p) => p.scriptId,
  entityTitle: (_p, r) => r?.title,
  description: (ctx) =>
    ctx.extra?.oldTitle && ctx.extra.oldTitle !== ctx.entityTitle
      ? scriptActions.rename(ctx)
      : scriptActions.edit(ctx),
  resolveCtx: async (context, param) => {
    const script = await Script.get(context, param.scriptId);
    return { extra: { oldTitle: script?.title } };
  },
};

const deleteSchema = z.object({
  scriptId: z.string(),
});

export const ScriptDeleteContract: OperationContract<typeof deleteSchema> = {
  name: OperationName.scriptDelete,
  version: 1,
  entity: MetaTable.AUTOMATIONS,
  schema: deleteSchema,
  entityId: (p) => p.scriptId,
  description: scriptActions.delete,
  resolveCtx: async (context, param) => {
    const script = await Script.get(context, param.scriptId);
    return { entityTitle: script?.title };
  },
};
