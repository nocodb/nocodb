import type { OperationContract } from '~/command-registry/types';
import type { TablesService } from '~/services/tables.service';
import type { BaseTrashService } from '~/services/base-trash/base-trash.service';
import BaseTrash from '~/models/BaseTrash';
import { OperationName } from '~/command-registry/op-names';
import { OperationRegistry } from '~/command-registry/registry';
import { makeReplayReq } from '~/command-registry/replay-context';
import { scopeBase } from '~/command-registry/scope';
import { isReplay, setReplay } from '~/helpers/replayScope';
import { MetaTable } from '~/utils/globals';
import { Model } from '~/models';
import { pickFields } from '~/utils/tsUtils';
import { tableActions } from '~/decorators/trace-command-descriptions';
import {
  tableCreateSchema,
  tableDeleteSchema,
  tableReorderSchema,
  tableUpdateSchema,
} from '~/command-registry/operations/_schemas/table';

export const TableCreateContract: OperationContract<
  typeof tableCreateSchema,
  Record<string, any>,
  Model | undefined
> = {
  name: OperationName.tableCreate,
  entity: MetaTable.MODELS,
  schema: tableCreateSchema,
  entry: {
    entity_id: 'id',
    entity_title: 'title',
    description: tableActions.add,
  },
  capture: ['sandboxColumns', 'sandboxDefaultViewId'],
  sandbox: {
    id_field: 'table',
  },
  undo: {
    inverse: (_context, _params, result, resolved) => {
      const tableId = result?.id ?? resolved?.entityId;
      if (!tableId) return null;
      return {
        name: OperationName.tableDelete,
        params: { tableId, forceDeleteSyncs: true },
      };
    },
    scope: (_p, _r, _c, context) => scopeBase(context),
  },
};

const TABLE_PREV_KEYS = [
  'title',
  'table_name',
  'description',
  'meta',
] as const satisfies readonly (keyof Model)[];

type TablePrev = Pick<Model, (typeof TABLE_PREV_KEYS)[number]>;

interface TableUpdateExtra {
  oldTitle?: string;
  prev?: TablePrev;
}

export const TableUpdateContract: OperationContract<
  typeof tableUpdateSchema,
  TableUpdateExtra,
  Model | undefined
> = {
  name: OperationName.tableUpdate,
  entity: MetaTable.MODELS,
  schema: tableUpdateSchema,
  entry: {
    entity_id: (params) => params.tableId,
    entity_title: (params) => params.table?.title,
    description: tableActions.rename,
    before: async (context, params) => {
      const table = await Model.get(context, params.tableId);
      if (!table) return {};
      return {
        extra: {
          oldTitle: table.title,
          prev: pickFields(table, TABLE_PREV_KEYS),
        },
      };
    },
  },
  undo: {
    inverse: (_context, params, _result, resolved) => {
      const prev = resolved?.extra?.prev;
      const forwardBody = params.table;
      if (!prev || !forwardBody) return null;
      const inverseBody: Record<string, unknown> = {};
      for (const k of TABLE_PREV_KEYS) {
        if (k in forwardBody) inverseBody[k] = prev[k];
      }
      if (!Object.keys(inverseBody).length) return null;
      return {
        name: OperationName.tableUpdate,
        params: { tableId: params.tableId, table: inverseBody },
      };
    },
    scope: (_p, _r, _c, context) => scopeBase(context),
  },
};

interface TableReorderExtra {
  prevOrder?: number;
  oldTitle?: string;
}

export const TableReorderContract: OperationContract<
  typeof tableReorderSchema,
  TableReorderExtra,
  unknown
> = {
  name: OperationName.tableReorder,
  entity: MetaTable.MODELS,
  schema: tableReorderSchema,
  entry: {
    entity_id: (params) => params.tableId,
    description: tableActions.edit,
    before: async (context, params) => {
      const table = await Model.get(context, params.tableId);
      if (!table) return {};
      return {
        entityTitle: table.title,
        extra: {
          oldTitle: table.title,
          prevOrder: typeof table.order === 'number' ? table.order : undefined,
        },
      };
    },
  },
  undo: {
    inverse: (_context, params, _result, resolved) => {
      const prev = resolved?.extra?.prevOrder;
      if (typeof prev !== 'number') return null;
      // Skip a no-op reorder (forward set the same order).
      if (prev === params.order) return null;
      return {
        name: OperationName.tableReorder,
        params: { tableId: params.tableId, order: prev },
      };
    },
    scope: (_p, _r, _c, context) => scopeBase(context),
  },
};

export const TableDeleteContract: OperationContract<
  typeof tableDeleteSchema,
  Record<string, any>,
  boolean
> = {
  name: OperationName.tableDelete,
  entity: MetaTable.MODELS,
  schema: tableDeleteSchema,
  entry: {
    entity_id: (params) => params.tableId,
    description: tableActions.delete,
    before: async (context, params) => {
      const table = await Model.get(context, params.tableId);
      return { entityTitle: table?.title };
    },
  },
  undo: {
    inverse: (_context, params) => {
      if (params.skipTrash) return null;
      return {
        name: OperationName.trashRestore,
        params: { resourceType: 'table', resourceId: params.tableId },
      };
    },
    scope: (_p, _r, _c, context) => scopeBase(context),
  },
};

export function registerTableHandlers(
  svc: TablesService,
  baseTrashSvc: BaseTrashService,
): void {
  OperationRegistry.register(
    TableCreateContract,
    async (context, params, meta) => {
      const req = makeReplayReq(meta.originalReq, meta.createdBy);

      if (isReplay() && meta.entityId) {
        const trashEntry = await BaseTrash.getByResourceId(
          context,
          'table',
          meta.entityId,
        );
        if (trashEntry?.id) {
          await baseTrashSvc.restore(context, {
            trashId: trashEntry.id,
            user: req.user,
            req,
          });
          return { id: meta.entityId };
        }
      }

      const sandboxColumns = meta.extra?.sandboxColumns;
      let colIdMap: Record<string, string> | undefined;
      if (sandboxColumns?.length) {
        colIdMap = {};
        for (const c of sandboxColumns) {
          if (!c.id) continue;
          if (c.title) colIdMap[c.title] = c.id;
          if (c.cn) colIdMap[c.cn] = c.id;
        }
      }

      if (colIdMap) setReplay('sandboxColumnIds', colIdMap);
      const sandboxDefaultViewId = meta.extra?.sandboxDefaultViewId;
      if (sandboxDefaultViewId) {
        setReplay('sandboxDefaultViewId', sandboxDefaultViewId);
      }
      return svc.tableCreate(context, {
        ...params,
        req,
      } as unknown as Parameters<typeof svc.tableCreate>[1]);
    },
  );

  OperationRegistry.register(
    TableUpdateContract,
    async (context, params, meta) => {
      const req = makeReplayReq(meta.originalReq, meta.createdBy);
      return svc.tableUpdate(context, {
        ...params,
        req,
      } as unknown as Parameters<typeof svc.tableUpdate>[1]);
    },
  );

  OperationRegistry.register(
    TableReorderContract,
    async (context, params, meta) => {
      const req = makeReplayReq(meta.originalReq, meta.createdBy);
      return svc.reorderTable(context, {
        tableId: params.tableId,
        order: params.order,
        req,
      });
    },
  );

  OperationRegistry.register(
    TableDeleteContract,
    async (context, params, meta) => {
      const req = makeReplayReq(meta.originalReq, meta.createdBy);
      return svc.tableDelete(context, {
        tableId: params.tableId,
        forceDeleteRelations: params.forceDeleteRelations,
        forceDeleteSyncs: params.forceDeleteSyncs,
        skipLinkPlaceholder: params.skipLinkPlaceholder,
        skipTrash: params.skipTrash,
        parent:
          params.parent?.type && params.parent.id
            ? {
                type: params.parent.type,
                id: params.parent.id,
                name: params.parent.name,
              }
            : undefined,
        req,
      });
    },
  );
}
