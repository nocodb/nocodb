import type { OperationContract } from '~/command-registry/types';
import type { ExtensionsService } from '~/services/extensions.service';
import BaseTrash from '~/ee/models/BaseTrash';
import { OperationName } from '~/command-registry/op-names';
import { OperationRegistry } from '~/command-registry/registry';
import {
  makeReplayReq,
  registerForward,
} from '~/command-registry/replay-context';
import { isReplay } from '~/helpers/replayScope';
import { MetaTable } from '~/utils/globals';
import { Extension } from '~/models';
import { pickFields } from '~/utils/tsUtils';
import { extensionActions } from '~/decorators/trace-command-descriptions';
import {
  extensionCreateSchema,
  extensionDeleteSchema,
  extensionUpdateSchema,
} from '~/command-registry/operations/_schemas/extension';

export const ExtensionCreateContract: OperationContract<
  typeof extensionCreateSchema,
  Record<string, any>,
  Extension | undefined
> = {
  name: OperationName.extensionCreate,
  entity: MetaTable.EXTENSIONS,
  schema: extensionCreateSchema,
  entry: {
    entity_id: 'id',
    entity_title: (params, result) => params.extension.title ?? result?.title,
    description: extensionActions.add,
  },
  sandbox: { id_field: 'extension' },
  undo: {
    inverse: (_context, _params, result) => {
      const newId = result?.id;
      if (!newId) return null;
      return {
        name: OperationName.extensionDelete,
        params: { extensionId: newId },
      };
    },
  },
};

const EXTENSION_PREV_FIELDS = [
  'title',
  'kv_store',
  'meta',
  'order',
] as const satisfies readonly (keyof Extension)[];

type ExtensionPrev = Pick<Extension, (typeof EXTENSION_PREV_FIELDS)[number]>;

interface ExtensionUpdateExtra {
  oldTitle?: string;
  prev?: ExtensionPrev;
}

export const ExtensionUpdateContract: OperationContract<
  typeof extensionUpdateSchema,
  ExtensionUpdateExtra,
  Extension | undefined
> = {
  name: OperationName.extensionUpdate,
  entity: MetaTable.EXTENSIONS,
  schema: extensionUpdateSchema,
  entry: {
    entity_id: (params) => params.extensionId,
    entity_title: (params) => params.extension.title,
    description: (context) =>
      context.extra?.oldTitle && context.extra.oldTitle !== context.entityTitle
        ? extensionActions.rename(context)
        : extensionActions.edit(context),
    before: async (context, params) => {
      const ext = await Extension.get(context, params.extensionId);
      if (!ext) return {};
      return {
        extra: {
          oldTitle: ext.title,
          prev: pickFields(ext, EXTENSION_PREV_FIELDS),
        },
      };
    },
  },
  undo: {
    inverse: (_context, params, _result, resolved) => {
      const prev = resolved?.extra?.prev;
      if (!prev) return null;
      return {
        name: OperationName.extensionUpdate,
        params: { extensionId: params.extensionId, extension: prev },
      };
    },
  },
};

export const ExtensionDeleteContract: OperationContract<
  typeof extensionDeleteSchema,
  Record<string, any>,
  boolean
> = {
  name: OperationName.extensionDelete,
  entity: MetaTable.EXTENSIONS,
  schema: extensionDeleteSchema,
  entry: {
    entity_id: (params) => params.extensionId,
    description: extensionActions.delete,
    before: async (context, params) => {
      const ext = await Extension.get(context, params.extensionId);
      return { entityTitle: ext?.title };
    },
  },
  undo: {
    inverse: (_context, params) => {
      if (params.skipTrash) return null;
      return {
        name: OperationName.trashRestore,
        params: { resourceType: 'extension', resourceId: params.extensionId },
      };
    },
  },
};

export function registerExtensionHandlers(svc: ExtensionsService): void {
  OperationRegistry.register(
    ExtensionCreateContract,
    async (context, params, meta) => {
      const req = makeReplayReq(meta.originalReq, meta.createdBy);
      if (isReplay() && meta.entityId) {
        const trashEntry = await BaseTrash.getByResourceId(
          context,
          'extension',
          meta.entityId,
        );
        if (trashEntry?.id) {
          return svc.restoreExtension(context, {
            extensionId: meta.entityId,
            req,
          });
        }
      }

      return svc.extensionCreate(context, {
        ...params,
        req,
      } as Parameters<typeof svc.extensionCreate>[1]);
    },
  );

  registerForward(ExtensionUpdateContract, (context, params) =>
    svc.extensionUpdate(context, params),
  );
  registerForward(ExtensionDeleteContract, (context, params) =>
    svc.extensionDelete(context, params),
  );
}
