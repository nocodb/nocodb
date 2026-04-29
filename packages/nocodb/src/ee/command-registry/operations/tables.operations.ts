import { z } from 'zod';
import { NcApiVersion } from 'nocodb-sdk';
import type { OperationContract } from 'src/command-registry/_types';
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
  name: 'tableCreate',
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
};

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

export const TableUpdateContract: OperationContract<typeof updateSchema> = {
  name: 'tableUpdate',
  version: 1,
  entity: MetaTable.MODELS,
  schema: updateSchema,
  entityId: (p) => p.tableId,
  entityTitle: (p) => p.table?.title,
  description: tableActions.rename,
  resolveCtx: async (context, param) => {
    const table = await Model.get(context, param.tableId);
    return { extra: { oldTitle: table?.title } };
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
  name: 'tableDelete',
  version: 1,
  entity: MetaTable.MODELS,
  schema: deleteSchema,
  entityId: (p) => p.tableId,
  description: tableActions.delete,
  resolveCtx: async (context, param) => {
    const table = await Model.get(context, param.tableId);
    return { entityTitle: table?.title };
  },
};
