import { z } from 'zod';
import type { OperationContract } from 'src/command-registry/types';
import { OperationName } from '~/command-registry/op-names';
import { MetaTable } from '~/utils/globals';
import { Hook, Model } from '~/models';
import { hookActions } from '~/decorators/trace-command-descriptions';

const hookBodySchema = z.record(z.unknown());

const createSchema = z.object({
  tableId: z.string(),
  hook: hookBodySchema,
});

export const HookCreateContract: OperationContract<typeof createSchema> = {
  name: OperationName.hookCreate,
  version: 1,
  entity: MetaTable.HOOKS,
  schema: createSchema,
  idField: 'hook',
  entityId: 'id',
  entityTitle: 'title',
  parentId: 'tableId',
  description: hookActions.add,
  resolveCtx: async (context, param) => {
    const table = await Model.get(context, param.tableId);
    return { parentEntityTitle: table?.title };
  },
};

const updateSchema = z.object({
  hookId: z.string(),
  hook: hookBodySchema,
});

export const HookUpdateContract: OperationContract<typeof updateSchema> = {
  name: OperationName.hookUpdate,
  version: 1,
  entity: MetaTable.HOOKS,
  schema: updateSchema,
  entityId: (p) => p.hookId,
  entityTitle: (p) => (p.hook as any)?.title,
  description: (ctx) =>
    ctx.extra?.oldTitle && ctx.extra.oldTitle !== ctx.entityTitle
      ? hookActions.rename(ctx)
      : hookActions.edit(ctx),
  resolveCtx: async (context, param) => {
    const hook = await Hook.get(context, param.hookId);
    const table = hook?.fk_model_id
      ? await Model.get(context, hook.fk_model_id)
      : undefined;
    return {
      parentEntityTitle: table?.title,
      extra: { oldTitle: hook?.title },
    };
  },
};

const deleteSchema = z.object({
  hookId: z.string(),
});

export const HookDeleteContract: OperationContract<typeof deleteSchema> = {
  name: OperationName.hookDelete,
  version: 1,
  entity: MetaTable.HOOKS,
  schema: deleteSchema,
  entityId: (p) => p.hookId,
  description: hookActions.delete,
  resolveCtx: async (context, param) => {
    const hook = await Hook.get(context, param.hookId);
    const table = hook?.fk_model_id
      ? await Model.get(context, hook.fk_model_id)
      : undefined;
    return {
      entityTitle: hook?.title,
      parentEntityTitle: table?.title,
    };
  },
};
