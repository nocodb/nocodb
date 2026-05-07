import type { OperationContract } from '~/command-registry/types';
import type { ScriptsService } from '~/services/scripts.service';
import BaseTrash from '~/ee/models/BaseTrash';
import { OperationName } from '~/command-registry/op-names';
import { OperationRegistry } from '~/command-registry/registry';
import {
  makeReplayReq,
  registerForward,
} from '~/command-registry/replay-context';
import { isReplay, setReplay } from '~/helpers/replayScope';
import { MetaTable } from '~/utils/globals';
import { Script } from '~/models';
import { pickFields } from '~/utils/tsUtils';
import {
  bScript,
  scriptActions,
} from '~/decorators/trace-command-descriptions';
import {
  scriptCreateSchema,
  scriptDeleteSchema,
  scriptDuplicateSchema,
  scriptUpdateSchema,
} from '~/command-registry/operations/_schemas/automation';

export const ScriptCreateContract: OperationContract<
  typeof scriptCreateSchema
> = {
  name: OperationName.scriptCreate,
  entity: MetaTable.AUTOMATIONS,
  schema: scriptCreateSchema,
  entry: {
    entity_id: 'id',
    entity_title: 'title',
    description: scriptActions.add,
  },
  sandbox: { id_field: 'body' },
  undo: {
    inverse: (_context, _params, result) => {
      const newId = (result as { id?: string } | undefined)?.id;
      if (!newId) return null;
      return {
        name: OperationName.scriptDelete,
        params: { scriptId: newId },
      };
    },
  },
};

const SCRIPT_PREV_FIELDS = [
  'title',
  'description',
  'script',
  'meta',
  'config',
  'order',
] as const satisfies readonly (keyof Script)[];

type ScriptPrev = Pick<Script, (typeof SCRIPT_PREV_FIELDS)[number]>;

interface ScriptUpdateExtra {
  oldTitle?: string;
  prev?: ScriptPrev;
}

export const ScriptUpdateContract: OperationContract<
  typeof scriptUpdateSchema,
  ScriptUpdateExtra
> = {
  name: OperationName.scriptUpdate,
  entity: MetaTable.AUTOMATIONS,
  schema: scriptUpdateSchema,
  entry: {
    entity_id: (params) => params.scriptId,
    entity_title: (_params, result) =>
      (result as { title?: string } | undefined)?.title,
    description: (context) =>
      context.extra?.oldTitle && context.extra.oldTitle !== context.entityTitle
        ? scriptActions.rename(context)
        : scriptActions.edit(context),
    before: async (context, params) => {
      const script = await Script.get(context, params.scriptId);
      if (!script) return {};
      return {
        extra: {
          oldTitle: script.title,
          prev: pickFields(script, SCRIPT_PREV_FIELDS),
        },
      };
    },
  },
  undo: {
    inverse: (_context, params, _result, resolved) => {
      const prev = resolved?.extra?.prev;
      if (!prev) return null;
      return {
        name: OperationName.scriptUpdate,
        params: { scriptId: params.scriptId, body: prev },
      };
    },
  },
};

export const ScriptDeleteContract: OperationContract<
  typeof scriptDeleteSchema
> = {
  name: OperationName.scriptDelete,
  entity: MetaTable.AUTOMATIONS,
  schema: scriptDeleteSchema,
  entry: {
    entity_id: (params) => params.scriptId,
    description: scriptActions.delete,
    before: async (context, params) => {
      const script = await Script.get(context, params.scriptId);
      return { entityTitle: script?.title };
    },
  },
  undo: {
    inverse: (_context, params) => {
      if (params.skipTrash) return null;
      return {
        name: OperationName.trashRestore,
        params: { resourceType: 'script', resourceId: params.scriptId },
      };
    },
  },
};

export const ScriptDuplicateContract: OperationContract<
  typeof scriptDuplicateSchema
> = {
  name: OperationName.scriptDuplicate,
  entity: MetaTable.AUTOMATIONS,
  schema: scriptDuplicateSchema,
  entry: {
    entity_id: (_params, result) =>
      (result as { id?: string } | undefined)?.id,
    entity_title: (_params, result) =>
      (result as { title?: string } | undefined)?.title,
    description: ({ entityTitle }) =>
      `Duplicate ${bScript(entityTitle)} script`,
    before: async (context, params) => {
      const script = await Script.get(context, params.scriptId);
      return { entityTitle: script?.title };
    },
  },
  undo: {
    inverse: (_context, _params, result) => {
      const newId = (result as { id?: string } | undefined)?.id;
      if (!newId) return null;
      return {
        name: OperationName.scriptDelete,
        params: { scriptId: newId },
      };
    },
  },
};

export function registerScriptHandlers(svc: ScriptsService): void {
  OperationRegistry.register(
    ScriptCreateContract,
    async (context, params, meta) => {
      const req = makeReplayReq(meta.originalReq, meta.createdBy);
      if (isReplay() && meta.entityId) {
        const trashEntry = await BaseTrash.getByResourceId(
          context,
          'script',
          meta.entityId,
        );
        if (trashEntry?.id) {
          return svc.restoreScript(context, { scriptId: meta.entityId, req });
        }
      }
      return svc.createScript(context, {
        ...params,
        req,
      } as Parameters<typeof svc.createScript>[1]);
    },
  );

  registerForward(ScriptUpdateContract, (context, params) =>
    svc.updateScript(context, params),
  );
  registerForward(ScriptDeleteContract, (context, params) =>
    svc.deleteScript(context, params),
  );

  OperationRegistry.register(
    ScriptDuplicateContract,
    async (context, params, meta) => {
      const req = makeReplayReq(meta.originalReq, meta.createdBy);
      if (isReplay() && meta.entityId) {
        setReplay('replayDuplicateId', meta.entityId);
      }
      return svc.duplicateScript(context, {
        scriptId: params.scriptId,
        req,
      });
    },
  );
}
