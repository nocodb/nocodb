import { z } from 'zod';
import type { OperationContract } from 'src/command-registry/_types';
import { MetaTable } from '~/utils/globals';
import { Column, Model, Sort, View } from '~/models';
import {
  sortActions,
  viewColumnActions,
  visibilityActions,
} from '~/decorators/trace-command-descriptions';

// ─────────────────────────────────────────────────────────────
// Sort contracts
// ─────────────────────────────────────────────────────────────

const sortBodySchema = z.record(z.unknown());

const sortCreateSchema = z.object({
  viewId: z.string(),
  sort: sortBodySchema,
});

export const SortCreateContract: OperationContract<typeof sortCreateSchema> = {
  name: 'sortCreate',
  version: 1,
  entity: MetaTable.SORT,
  schema: sortCreateSchema,
  idField: 'sort',
  entityId: 'id',
  parentId: 'viewId',
  description: sortActions.add,
  resolveCtx: async (context, param) => {
    const view = await View.get(context, param.viewId);
    const field = (param.sort as any)?.fk_column_id
      ? await Column.get(context, { colId: (param.sort as any).fk_column_id })
      : undefined;
    const table = view?.fk_model_id
      ? await Model.get(context, view.fk_model_id)
      : undefined;
    return {
      parentEntityTitle: view?.title,
      extra: { fieldTitle: field?.title, tableTitle: table?.title },
    };
  },
  deps: (_p, r) =>
    r?.fk_column_id ? [{ entity: MetaTable.COLUMNS, id: r.fk_column_id }] : [],
};

const sortUpdateSchema = z.object({
  sortId: z.string(),
  sort: sortBodySchema,
});

export const SortUpdateContract: OperationContract<typeof sortUpdateSchema> = {
  name: 'sortUpdate',
  version: 1,
  entity: MetaTable.SORT,
  schema: sortUpdateSchema,
  entityId: (p) => p.sortId,
  description: sortActions.edit,
  resolveCtx: async (context, param) => {
    const sort = await Sort.get(context, param.sortId);
    if (!sort) return {};
    const view = sort.fk_view_id
      ? await View.get(context, sort.fk_view_id)
      : undefined;
    const table = view?.fk_model_id
      ? await Model.get(context, view.fk_model_id)
      : undefined;
    const colId = (param.sort as any)?.fk_column_id ?? sort.fk_column_id;
    const field = colId ? await Column.get(context, { colId }) : undefined;
    return {
      parentEntityTitle: view?.title,
      extra: { fieldTitle: field?.title, tableTitle: table?.title },
    };
  },
  deps: (p, r) => {
    const colId = r?.fk_column_id ?? (p.sort as any)?.fk_column_id;
    return colId ? [{ entity: MetaTable.COLUMNS, id: colId }] : [];
  },
};

const sortDeleteSchema = z.object({
  sortId: z.string(),
});

export const SortDeleteContract: OperationContract<typeof sortDeleteSchema> = {
  name: 'sortDelete',
  version: 1,
  entity: MetaTable.SORT,
  schema: sortDeleteSchema,
  entityId: (p) => p.sortId,
  description: sortActions.delete,
  resolveCtx: async (context, param) => {
    const sort = await Sort.get(context, param.sortId);
    if (!sort) return {};
    const view = sort.fk_view_id
      ? await View.get(context, sort.fk_view_id)
      : undefined;
    const table = view?.fk_model_id
      ? await Model.get(context, view.fk_model_id)
      : undefined;
    const field = sort.fk_column_id
      ? await Column.get(context, { colId: sort.fk_column_id })
      : undefined;
    return {
      parentEntityTitle: view?.title,
      extra: { fieldTitle: field?.title, tableTitle: table?.title },
    };
  },
};

// ─────────────────────────────────────────────────────────────
// ViewColumn contract
// ─────────────────────────────────────────────────────────────

const viewColumnUpdateSchema = z.object({
  viewId: z.string(),
  columnId: z.string(),
  column: z.record(z.unknown()),
});

export const ViewColumnUpdateContract: OperationContract<
  typeof viewColumnUpdateSchema
> = {
  name: 'viewColumnUpdate',
  version: 1,
  entity: MetaTable.GRID_VIEW_COLUMNS,
  schema: viewColumnUpdateSchema,
  entityId: (p) => p.columnId,
  parentId: 'viewId',
  description: viewColumnActions.update,
  resolveCtx: async (context, param) => {
    const view = await View.get(context, param.viewId);
    const table = view?.fk_model_id
      ? await Model.get(context, view.fk_model_id)
      : undefined;
    const field = param.columnId
      ? await Column.get(context, { colId: param.columnId })
      : undefined;
    return {
      parentEntityTitle: view?.title,
      extra: { fieldTitle: field?.title, tableTitle: table?.title },
    };
  },
  deps: (p) =>
    p.columnId ? [{ entity: MetaTable.COLUMNS, id: p.columnId }] : [],
};

// ─────────────────────────────────────────────────────────────
// ModelVisibility contract
// ─────────────────────────────────────────────────────────────

const visibilityUpdateSchema = z.object({
  baseId: z.string(),
  visibilityRule: z.record(z.unknown()),
});

export const VisibilityUpdateContract: OperationContract<
  typeof visibilityUpdateSchema
> = {
  name: 'visibilityUpdate',
  version: 1,
  entity: MetaTable.MODEL_ROLE_VISIBILITY,
  schema: visibilityUpdateSchema,
  entityId: (p) => p.baseId,
  description: visibilityActions.update,
};
