import type { NcContext } from '~/interface/config';
import type { Filter as FilterModel } from '~/models';
import type { OperationContract } from '~/command-registry/types';
import type { HooksService } from '~/services/hooks.service';
import BaseTrash from '~/ee/models/BaseTrash';
import { OperationName } from '~/command-registry/op-names';
import { OperationRegistry } from '~/command-registry/registry';
import {
  makeReplayReq,
  registerForward,
} from '~/command-registry/replay-context';
import { isReplay } from '~/helpers/replayScope';
import { MetaTable } from '~/utils/globals';
import { Filter, Hook, Model } from '~/models';
import { pickFields } from '~/utils/tsUtils';
import { hookActions } from '~/decorators/trace-command-descriptions';
import {
  hookCreateSchema,
  hookDeleteSchema,
  hookUpdateSchema,
} from '~/command-registry/operations/_schemas/hook';
import { pickFilterTreeFields } from '~/command-registry/operations/shared/filter-snapshot';

// Persistable hook fields the inverse needs to restore on undo. Mirrors
// the field list `Hook.update`'s `extractProps` accepts.
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
  'url',
  'headers',
  'payload',
] as const satisfies readonly (keyof Hook)[];

type HookPrev = Pick<Hook, (typeof HOOK_PREV_FIELDS)[number]>;

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
    return pickFilterTreeFields(f, childNodes);
  };
  return Promise.all(roots.map((result) => walk(result as FilterModel)));
}

export const HookCreateContract: OperationContract<
  typeof hookCreateSchema,
  Record<string, any>,
  Hook | undefined
> = {
  name: OperationName.hookCreate,
  entity: MetaTable.HOOKS,
  schema: hookCreateSchema,
  entry: {
    entity_id: 'id',
    entity_title: 'title',
    parent_id: 'tableId',
    description: hookActions.add,
    before: async (context, params) => {
      const table = await Model.get(context, params.tableId);
      return { parentEntityTitle: table?.title };
    },
  },
  sandbox: { id_field: 'hook', capture: ['filters'] },
  undo: {
    inverse: (_context, _params, result) => {
      if (!result?.id) return null;
      return {
        name: OperationName.hookDelete,
        params: { hookId: result.id },
      };
    },
  },
};

interface HookUpdatePrev {
  hook?: HookPrev;
  filters?: Array<Record<string, unknown>>;
}

interface HookUpdateExtra {
  oldTitle?: string;
  prev?: HookUpdatePrev;
}

export const HookUpdateContract: OperationContract<
  typeof hookUpdateSchema,
  HookUpdateExtra,
  Hook | undefined
> = {
  name: OperationName.hookUpdate,
  entity: MetaTable.HOOKS,
  schema: hookUpdateSchema,
  entry: {
    entity_id: (params) => params.hookId,
    entity_title: (params) => params.hook.title,
    description: (context) =>
      context.extra?.oldTitle && context.extra.oldTitle !== context.entityTitle
        ? hookActions.rename(context)
        : hookActions.edit(context),
    before: async (context, params) => {
      const hook = await Hook.get(context, params.hookId);
      const table = hook?.fk_model_id
        ? await Model.get(context, hook.fk_model_id)
        : undefined;
      const prevHook = hook ? pickFields(hook, HOOK_PREV_FIELDS) : undefined;
      const willReplaceFilters = Array.isArray(
        (params.hook as Record<string, unknown>)?.filters,
      );
      const prevFilters = willReplaceFilters
        ? await snapshotHookFilterTree(context, params.hookId)
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
  },
  undo: {
    inverse: (_context, params, _result, resolved) => {
      const prev = resolved?.extra?.prev;
      if (!prev?.hook) return null;
      return {
        name: OperationName.hookUpdate,
        params: {
          hookId: params.hookId,
          hook: {
            ...prev.hook,
            ...(prev.filters ? { filters: prev.filters } : {}),
          },
        },
      };
    },
  },
};

export const HookDeleteContract: OperationContract<
  typeof hookDeleteSchema,
  Record<string, any>,
  boolean
> = {
  name: OperationName.hookDelete,
  entity: MetaTable.HOOKS,
  schema: hookDeleteSchema,
  entry: {
    entity_id: (params) => params.hookId,
    description: hookActions.delete,
    before: async (context, params) => {
      const hook = await Hook.get(context, params.hookId);
      const table = hook?.fk_model_id
        ? await Model.get(context, hook.fk_model_id)
        : undefined;
      return {
        entityTitle: hook?.title,
        parentEntityTitle: table?.title,
      };
    },
  },
  undo: {
    inverse: (_context, params) => {
      if (params.skipTrash) return null;
      return {
        name: OperationName.trashRestore,
        params: { resourceType: 'hook', resourceId: params.hookId },
      };
    },
  },
};

export function registerHookHandlers(svc: HooksService): void {
  OperationRegistry.register(
    HookCreateContract,
    async (context, params, meta) => {
      const req = makeReplayReq(meta.originalReq, meta.createdBy);
      if (isReplay() && meta.entityId) {
        const trashEntry = await BaseTrash.getByResourceId(
          context,
          'hook',
          meta.entityId,
        );
        if (trashEntry?.id) {
          return svc.hookRestore(context, { hookId: meta.entityId, req });
        }
      }
      const capturedFilters = meta.extra?.filters;
      return svc.hookCreate(context, {
        ...params,
        hook: {
          ...params.hook,
          ...(capturedFilters?.length ? { filters: capturedFilters } : {}),
        },
        req,
      } as Parameters<typeof svc.hookCreate>[1]);
    },
  );

  registerForward(HookUpdateContract, (context, params) =>
    svc.hookUpdate(context, params),
  );
  registerForward(HookDeleteContract, (context, params) =>
    svc.hookDelete(context, params),
  );
}
