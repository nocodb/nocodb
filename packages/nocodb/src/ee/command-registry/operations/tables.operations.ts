import { z } from 'zod';
import { NcApiVersion } from 'nocodb-sdk';
import type { OperationContract } from 'src/command-registry/types';
import { OperationName } from '~/command-registry/op-names';
import { MetaTable } from '~/utils/globals';
import { Model } from '~/models';
import { tableActions } from '~/decorators/trace-command-descriptions';

const tableBodySchema = z
  .object({
    title: z.string().optional(),
    table_name: z.string().optional(),
    columns: z.array(z.record(z.any())).optional(),
    order: z.number().optional(),
    meta: z.record(z.any()).optional(),
    _sandboxColumnIds: z.record(z.string()).optional(),
    _sandboxDefaultViewId: z.string().optional(),
  })
  .passthrough();

const createSchema = z.object({
  baseId: z.string(),
  sourceId: z.string().optional(),
  table: tableBodySchema,
  synced: z.boolean().optional(),
  apiVersion: z.nativeEnum(NcApiVersion).optional(),
  isDuplicateOperation: z.boolean().optional(),
});

export const TableCreateContract: OperationContract<typeof createSchema> = {
  name: OperationName.tableCreate,
  version: 1,
  entity: MetaTable.MODELS,
  schema: createSchema,
  idField: 'table',
  entityId: 'id',
  entityTitle: 'title',
  description: tableActions.add,
  extraCommandMeta: (_p, result) => ({
    sandboxColumns: (result?.columns ?? []).map((c: any) => ({
      id: c.id,
      cn: c.cn,
      title: c.title,
    })),
    sandboxDefaultViewId: (result?.views ?? [])[0]?.id,
  }),
  buildInverse: (_ctx, _p, r) => {
    const newId = (r as { id?: string } | undefined)?.id;
    if (!newId) return null;
    return {
      name: OperationName.tableDelete,
      version: 1,
      params: { tableId: newId },
    };
  },
};

const TABLE_PREV_KEYS = ['title', 'table_name', 'description', 'meta'] as const;
type TableUpdateKey = (typeof TABLE_PREV_KEYS)[number];

interface TableUpdateExtra {
  oldTitle?: string;
  prev?: Partial<Record<TableUpdateKey, unknown>>;
}

const updateSchema = z.object({
  tableId: z.string(),
  table: z
    .object({
      title: z.string().optional(),
      table_name: z.string().optional(),
      base_id: z.string().optional(),
      meta: z.record(z.any()).optional(),
    })
    .passthrough()
    .optional(),
  baseId: z.string().optional(),
});

export const TableUpdateContract: OperationContract<
  typeof updateSchema,
  TableUpdateExtra
> = {
  name: OperationName.tableUpdate,
  version: 1,
  entity: MetaTable.MODELS,
  schema: updateSchema,
  entityId: (p) => p.tableId,
  entityTitle: (p) => p.table?.title,
  description: tableActions.rename,
  resolveCtx: async (context, param) => {
    const table = await Model.get(context, param.tableId);
    if (!table) return {};
    const src = table as unknown as Record<string, unknown>;
    const prev: Partial<Record<TableUpdateKey, unknown>> = {};
    for (const k of TABLE_PREV_KEYS) prev[k] = src[k];
    return { extra: { oldTitle: table.title, prev } };
  },
  buildInverse: (_ctx, p, _r, resolved) => {
    const prev = resolved?.extra?.prev;
    const forwardBody = p.table;
    if (!prev || !forwardBody) return null;
    const inverseBody: Record<string, unknown> = {};
    for (const k of TABLE_PREV_KEYS) {
      if (k in forwardBody) inverseBody[k] = prev[k];
    }
    if (!Object.keys(inverseBody).length) return null;
    return {
      name: OperationName.tableUpdate,
      version: 1,
      params: { tableId: p.tableId, table: inverseBody },
    };
  },
};

const deleteSchema = z.object({
  tableId: z.string(),
  forceDeleteRelations: z.boolean().optional(),
  forceDeleteSyncs: z.boolean().optional(),
  skipLinkPlaceholder: z.boolean().optional(),
  skipTrash: z.boolean().optional(),
});

export const TableDeleteContract: OperationContract<typeof deleteSchema> = {
  name: OperationName.tableDelete,
  version: 1,
  entity: MetaTable.MODELS,
  schema: deleteSchema,
  entityId: (p) => p.tableId,
  description: tableActions.delete,
  resolveCtx: async (context, param) => {
    const table = await Model.get(context, param.tableId);
    return { entityTitle: table?.title };
  },
  buildInverse: (_ctx, p) => {
    if (p.skipTrash) return null;
    return {
      name: OperationName.trashRestore,
      version: 1,
      params: { resourceType: 'table', resourceId: p.tableId },
    };
  },
};
