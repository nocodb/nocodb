import { z } from 'zod';
import { UITypes } from 'nocodb-sdk';
import type { OperationContract } from 'src/command-registry/types';
import { OperationName } from '~/command-registry/op-names';
import { MetaTable } from '~/utils/globals';
import { Column, Model } from '~/models';
import { fieldActions } from '~/decorators/trace-command-descriptions';
import { extractFormulaColumnRefs } from '~/ee/helpers/formulaDeps';

// ─── columnAdd ───────────────────────────────────────────────────────────────

const columnAddSchema = z.object({
  tableId: z.string(),
  column: z.record(z.unknown()),
});

export const ColumnAddContract: OperationContract<typeof columnAddSchema> = {
  name: OperationName.columnAdd,
  version: 1,
  entity: MetaTable.COLUMNS,
  schema: columnAddSchema,
  idField: 'column',
  entityId: (_p, r) => {
    // V3 path: result is Column (has fk_model_id)
    if ((r as any)?.fk_model_id !== undefined) return (r as any).id;
    // V1 path: result is Model; find the added column by title
    const title =
      (_p?.column as any)?.title ?? (_p?.column as any)?.column_name;
    return (r as any)?.columns?.find((c: any) => c.title === title)?.id;
  },
  entityTitle: (p) => (p?.column as any)?.title,
  parentId: 'tableId',
  description: fieldActions.add,
  resolveCtx: async (context, param) => {
    const table = await Model.get(context, param?.tableId);
    return { parentEntityTitle: table?.title };
  },
  deps: (_p, r) => {
    if (!r || (r as any).uidt !== UITypes.Formula) return [];
    const parsed = (r as any).parsed_tree ?? (r as any).colOptions?.parsed_tree;
    return extractFormulaColumnRefs(parsed).map((id) => ({
      entity: MetaTable.COLUMNS,
      id,
    }));
  },
};

// ─── columnUpdate ─────────────────────────────────────────────────────────────

const columnUpdateSchema = z.object({
  columnId: z.string(),
  column: z.record(z.unknown()),
  tableId: z.string().optional(),
});

export const ColumnUpdateContract: OperationContract<
  typeof columnUpdateSchema
> = {
  name: OperationName.columnUpdate,
  version: 1,
  entity: MetaTable.COLUMNS,
  schema: columnUpdateSchema,
  entityId: (p) => p?.columnId,
  entityTitle: (p) => (p?.column as any)?.title,
  parentId: (p) => (p?.column as any)?.fk_model_id ?? p?.tableId,
  description: (ctx) =>
    ctx.extra?.oldTitle && ctx.extra.oldTitle !== ctx.entityTitle
      ? fieldActions.rename(ctx)
      : fieldActions.edit(ctx),
  resolveCtx: async (context, param) => {
    const col = await Column.get(context, { colId: param?.columnId });
    const tableId = col?.fk_model_id;
    if (!tableId) return { extra: { oldTitle: col?.title } };
    const table = await Model.get(context, tableId);
    return {
      parentEntityTitle: table?.title,
      extra: { oldTitle: col?.title },
    };
  },
  deps: (_p, r) => {
    if (!r || (r as any).uidt !== UITypes.Formula) return [];
    const parsed = (r as any).parsed_tree ?? (r as any).colOptions?.parsed_tree;
    return extractFormulaColumnRefs(parsed).map((id) => ({
      entity: MetaTable.COLUMNS,
      id,
    }));
  },
};

// ─── columnDelete ─────────────────────────────────────────────────────────────

const columnDeleteSchema = z.object({
  columnId: z.string(),
});

export const ColumnDeleteContract: OperationContract<
  typeof columnDeleteSchema
> = {
  name: OperationName.columnDelete,
  version: 1,
  entity: MetaTable.COLUMNS,
  schema: columnDeleteSchema,
  entityId: (p) => p?.columnId,
  description: fieldActions.delete,
  resolveCtx: async (context, param) => {
    const col = await Column.get(context, { colId: param?.columnId });
    if (!col) return {};
    const table = col.fk_model_id
      ? await Model.get(context, col.fk_model_id)
      : undefined;
    return {
      entityTitle: col.title,
      parentEntityTitle: table?.title,
    };
  },
};

// ─── columnSetAsPrimary ───────────────────────────────────────────────────────

const columnSetAsPrimarySchema = z.object({
  columnId: z.string(),
});

export const ColumnSetAsPrimaryContract: OperationContract<
  typeof columnSetAsPrimarySchema
> = {
  name: OperationName.columnSetAsPrimary,
  version: 1,
  entity: MetaTable.COLUMNS,
  schema: columnSetAsPrimarySchema,
  entityId: (p) => p?.columnId,
  description: fieldActions.setAsPrimary,
  resolveCtx: async (context, param) => {
    const col = await Column.get(context, { colId: param?.columnId });
    if (!col) return {};
    const table = col.fk_model_id
      ? await Model.get(context, col.fk_model_id)
      : undefined;
    return {
      entityTitle: col.title,
      parentEntityTitle: table?.title,
    };
  },
};
