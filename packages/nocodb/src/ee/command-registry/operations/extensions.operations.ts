import { z } from 'zod';
import type { OperationContract } from 'src/command-registry/_types';
import { MetaTable } from '~/utils/globals';
import { Extension } from '~/models';
import { extensionActions } from '~/decorators/trace-command-descriptions';

const extensionBodySchema = z.record(z.unknown());

const createSchema = z.object({
  extension: extensionBodySchema,
});

export const ExtensionCreateContract: OperationContract<typeof createSchema> = {
  name: 'extensionCreate',
  version: 1,
  entity: MetaTable.EXTENSIONS,
  schema: createSchema,
  idField: 'extension',
  entityId: 'id',
  entityTitle: (p, r) => (p.extension as any)?.title ?? r?.title,
  description: extensionActions.add,
};

const updateSchema = z.object({
  extensionId: z.string(),
  extension: extensionBodySchema,
});

export const ExtensionUpdateContract: OperationContract<typeof updateSchema> = {
  name: 'extensionUpdate',
  version: 1,
  entity: MetaTable.EXTENSIONS,
  schema: updateSchema,
  entityId: (p) => p.extensionId,
  entityTitle: (p) => (p.extension as any)?.title,
  description: (ctx) =>
    ctx.extra?.oldTitle && ctx.extra.oldTitle !== ctx.entityTitle
      ? extensionActions.rename(ctx)
      : extensionActions.edit(ctx),
  resolveCtx: async (context, param) => {
    const ext = await Extension.get(context, param.extensionId);
    return { extra: { oldTitle: ext?.title } };
  },
};

const deleteSchema = z.object({
  extensionId: z.string(),
});

export const ExtensionDeleteContract: OperationContract<typeof deleteSchema> = {
  name: 'extensionDelete',
  version: 1,
  entity: MetaTable.EXTENSIONS,
  schema: deleteSchema,
  entityId: (p) => p.extensionId,
  description: extensionActions.delete,
  resolveCtx: async (context, param) => {
    const ext = await Extension.get(context, param.extensionId);
    return { entityTitle: ext?.title };
  },
};
