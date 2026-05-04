import { z } from 'zod';
import type { OperationContract } from 'src/command-registry/types';
import { OperationName } from '~/command-registry/op-names';
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
  buildInverse: (_ctx, _p, r) => {
    const newId = (r as { id?: string } | undefined)?.id;
    if (!newId) return null;
    return {
      name: OperationName.scriptDelete,
      version: 1,
      params: { scriptId: newId },
    };
  },
};

const SCRIPT_PREV_FIELDS = [
  'title',
  'description',
  'script',
  'meta',
  'config',
  'order',
] as const;

interface ScriptUpdateExtra {
  oldTitle?: string;
  prev?: Partial<Record<(typeof SCRIPT_PREV_FIELDS)[number], unknown>>;
}

const updateSchema = z.object({
  scriptId: z.string(),
  body: z
    .object({
      title: z.string().optional(),
    })
    .passthrough()
    .optional(),
});

export const ScriptUpdateContract: OperationContract<
  typeof updateSchema,
  ScriptUpdateExtra
> = {
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
    if (!script) return {};
    const src = script as unknown as Record<string, unknown>;
    const prev: Record<string, unknown> = {};
    for (const k of SCRIPT_PREV_FIELDS) prev[k] = src[k];
    return {
      extra: { oldTitle: script.title, prev },
    };
  },
  buildInverse: (_ctx, p, _r, resolved) => {
    const prev = resolved?.extra?.prev;
    if (!prev) return null;
    return {
      name: OperationName.scriptUpdate,
      version: 1,
      params: { scriptId: p.scriptId, body: prev as any },
    };
  },
};

const deleteSchema = z.object({
  scriptId: z.string(),
  skipTrash: z.boolean().optional(),
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
  buildInverse: (_ctx, p) => {
    if (p.skipTrash) return null;
    return {
      name: OperationName.trashRestore,
      version: 1,
      params: { resourceType: 'script', resourceId: p.scriptId },
    };
  },
};
