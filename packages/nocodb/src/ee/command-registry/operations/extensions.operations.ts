import { z } from 'zod';
import type { OperationContract } from 'src/command-registry/types';
import { OperationName } from '~/command-registry/op-names';
import { MetaTable } from '~/utils/globals';
import { Extension } from '~/models';
import { extensionActions } from '~/decorators/trace-command-descriptions';

const extensionBodySchema = z.record(z.unknown());

const createSchema = z.object({
  extension: extensionBodySchema,
});

export const ExtensionCreateContract: OperationContract<typeof createSchema> = {
  name: OperationName.extensionCreate,
  version: 1,
  entity: MetaTable.EXTENSIONS,
  schema: createSchema,
  idField: 'extension',
  entityId: 'id',
  entityTitle: (p, r) => (p.extension as any)?.title ?? r?.title,
  description: extensionActions.add,
  buildInverse: (_ctx, _p, r) => {
    const newId = (r as { id?: string } | undefined)?.id;
    if (!newId) return null;
    return {
      name: OperationName.extensionDelete,
      version: 1,
      params: { extensionId: newId },
    };
  },
};

const EXTENSION_PREV_FIELDS = ['title', 'kv_store', 'meta', 'order'] as const;

interface ExtensionUpdateExtra {
  oldTitle?: string;
  prev?: Partial<Record<(typeof EXTENSION_PREV_FIELDS)[number], unknown>>;
}

const updateSchema = z.object({
  extensionId: z.string(),
  extension: extensionBodySchema,
});

export const ExtensionUpdateContract: OperationContract<
  typeof updateSchema,
  ExtensionUpdateExtra
> = {
  name: OperationName.extensionUpdate,
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
    if (!ext) return {};
    const src = ext as unknown as Record<string, unknown>;
    const prev: Record<string, unknown> = {};
    for (const k of EXTENSION_PREV_FIELDS) prev[k] = src[k];
    return { extra: { oldTitle: ext.title, prev } };
  },
  buildInverse: (_ctx, p, _r, resolved) => {
    const prev = resolved?.extra?.prev;
    if (!prev) return null;
    return {
      name: OperationName.extensionUpdate,
      version: 1,
      params: { extensionId: p.extensionId, extension: prev as any },
    };
  },
};

const deleteSchema = z.object({
  extensionId: z.string(),
  skipTrash: z.boolean().optional(),
});

export const ExtensionDeleteContract: OperationContract<typeof deleteSchema> = {
  name: OperationName.extensionDelete,
  version: 1,
  entity: MetaTable.EXTENSIONS,
  schema: deleteSchema,
  entityId: (p) => p.extensionId,
  description: extensionActions.delete,
  resolveCtx: async (context, param) => {
    const ext = await Extension.get(context, param.extensionId);
    return { entityTitle: ext?.title };
  },
  buildInverse: (_ctx, p) => {
    if (p.skipTrash) return null;
    return {
      name: OperationName.trashRestore,
      version: 1,
      params: { resourceType: 'extension', resourceId: p.extensionId },
    };
  },
};
