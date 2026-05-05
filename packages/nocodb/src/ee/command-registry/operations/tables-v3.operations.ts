import { z } from 'zod';
import type { OperationContract } from 'src/command-registry/types';
import { OperationName } from '~/command-registry/op-names';
import { MetaTable } from '~/utils/globals';
import { tableActions } from '~/decorators/trace-command-descriptions';

const tableV3BodySchema = z
  .object({
    id: z.string().optional(),
    title: z.string().optional(),
    table_name: z.string().optional(),
    description: z.string().optional(),
    fields: z.array(z.record(z.any())).optional(),
    meta: z.record(z.any()).optional(),
  })
  .passthrough();

const tableV3CreateSchema = z.object({
  baseId: z.string(),
  table: tableV3BodySchema,
  sourceId: z.string().optional(),
});

export const TableV3CreateContract: OperationContract<
  typeof tableV3CreateSchema
> = {
  name: OperationName.tableV3Create,
  version: 1,
  entity: MetaTable.MODELS,
  schema: tableV3CreateSchema,
  idField: 'table',
  entityId: (_p, r) => (r as { id?: string } | undefined)?.id,
  entityTitle: (p, r) =>
    (r as { title?: string } | undefined)?.title ??
    p.table?.title ??
    p.table?.table_name,
  parentId: (p) => p.baseId,
  description: tableActions.add,
  extraCommandMeta: (_p, result) => {
    const fields = (result?.fields ?? []) as Array<{
      id?: string;
      title?: string;
      name?: string;
    }>;
    return {
      sandboxColumns: fields.map((f) => ({
        id: f.id,
        title: f.title ?? f.name,
      })),
      sandboxDefaultViewId: (result?.views ?? [])[0]?.id,
    };
  },
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
