import { z } from 'zod';
import type { NcContext } from '~/interface/config';
import type { Filter as FilterModel } from '~/models';
import type { OperationContract } from 'src/command-registry/types';
import { OperationName } from '~/command-registry/op-names';
import { MetaTable } from '~/utils/globals';
import { Filter, Hook, Model } from '~/models';
import { hookActions } from '~/decorators/trace-command-descriptions';

const hookBodySchema = z.record(z.unknown());

// Persistable hook fields the inverse needs to restore on undo.
const HOOK_PREV_FIELDS = [
  'title',
  'description',
  'env',
  'event',
  'operation',
  'async',
  'active',
  'condition',
  'notification',
  'retries',
  'retry_interval',
  'timeout',
  'type',
  'trigger_field',
  'trigger_fields',
  'version',
] as const;

function snapshotHookFields(
  hook: Hook | null | undefined,
): Record<string, unknown> | undefined {
  if (!hook) return undefined;
  const src = hook as unknown as Record<string, unknown>;
  const snap: Record<string, unknown> = {};
  for (const k of HOOK_PREV_FIELDS) {
    snap[k] = src[k];
  }
  return snap;
}

async function snapshotHookFilterTree(
  context: NcContext,
  hookId: string,
): Promise<Array<Record<string, unknown>>> {
  const roots = await Filter.rootFilterListByHook(context, { hookId });
  const walk = async (f: FilterModel): Promise<Record<string, unknown>> => {
    const children = f.is_group ? (await f.getChildren(context)) ?? [] : [];
    const childNodes = await Promise.all(
      children.map((c) => walk(c as FilterModel)),
    );
    return {
      ...(f as unknown as Record<string, unknown>),
      ...(childNodes.length ? { children: childNodes } : {}),
    };
  };
  return Promise.all(roots.map((r) => walk(r as FilterModel)));
}

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
  extraCommandMeta: (p) => {
    const captured = (p as { _capturedFilters?: unknown[] })._capturedFilters;
    if (!captured?.length) return undefined;
    return { filters: captured };
  },
  buildInverse: (_ctx, _p, r) => {
    const newId = (r as { id?: string } | undefined)?.id;
    if (!newId) return null;
    return {
      name: OperationName.hookDelete,
      version: 1,
      params: { hookId: newId },
    };
  },
};

interface HookUpdatePrev {
  hook?: Record<string, unknown>;
  filters?: Array<Record<string, unknown>>;
}

interface HookUpdateExtra {
  oldTitle?: string;
  prev?: HookUpdatePrev;
}

const updateSchema = z.object({
  hookId: z.string(),
  hook: hookBodySchema,
});

export const HookUpdateContract: OperationContract<
  typeof updateSchema,
  HookUpdateExtra
> = {
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
    const prevHook = snapshotHookFields(hook);
    const willReplaceFilters = Array.isArray(
      (param.hook as Record<string, unknown>)?.filters,
    );
    const prevFilters = willReplaceFilters
      ? await snapshotHookFilterTree(context, param.hookId)
      : undefined;
    return {
      parentEntityTitle: table?.title,
      extra: {
        oldTitle: hook?.title,
        prev: {
          ...(prevHook ? { hook: prevHook } : {}),
          ...(prevFilters ? { filters: prevFilters } : {}),
        },
      },
    };
  },
  buildInverse: (_ctx, p, _r, resolved) => {
    const prev = resolved?.extra?.prev;
    if (!prev?.hook) return null;
    return {
      name: OperationName.hookUpdate,
      version: 1,
      params: {
        hookId: p.hookId,
        hook: {
          ...prev.hook,
          ...(prev.filters ? { filters: prev.filters } : {}),
        },
      },
    };
  },
};

const deleteSchema = z.object({
  hookId: z.string(),
  skipTrash: z.boolean().optional(),
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
  buildInverse: (_ctx, p) => {
    if (p.skipTrash) return null;
    return {
      name: OperationName.trashRestore,
      version: 1,
      params: { resourceType: 'hook', resourceId: p.hookId },
    };
  },
};
