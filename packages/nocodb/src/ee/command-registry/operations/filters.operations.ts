import { z } from 'zod';
import type { BoolType, FilterType } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import type { OperationContract } from 'src/command-registry/types';
import type { TraceCommandDep } from 'src/command-registry/types';
import { OperationName } from '~/command-registry/op-names';
import { MetaTable } from '~/utils/globals';
import { Column, Filter, Model, View } from '~/models';
import RowColorCondition from '~/models/RowColorCondition';
import Widget from '~/models/Widget';
import {
  bField,
  bWidget,
  filterActions,
  rowColorConditionActions,
} from '~/decorators/trace-command-descriptions';

// ─── Reusable sub-schemas ───────────────────────────────────────────────────

const filterBodySchema = z.record(z.unknown());

// ─── filterCreate ────────────────────────────────────────────────────────────

const filterCreateSchema = z.object({
  filter: filterBodySchema,
  viewId: z.string(),
});

export const FilterCreateContract: OperationContract<
  typeof filterCreateSchema
> = {
  name: OperationName.filterCreate,
  version: 1,
  entity: MetaTable.FILTER_EXP,
  schema: filterCreateSchema,
  idField: 'filter',
  entityId: 'id',
  parentId: 'viewId',
  description: filterActions.add,
  resolveCtx: async (context, param) => {
    const view = await View.get(context, param?.viewId);
    const field = param?.filter?.fk_column_id
      ? await Column.get(context, {
          colId: param.filter.fk_column_id as string,
        })
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
  buildInverse: (_ctx, _p, r) => {
    if (!r?.id) return null;
    return {
      name: OperationName.filterDelete,
      version: 1,
      params: { filterId: r.id },
    };
  },
};

// ─── filterUpdate ────────────────────────────────────────────────────────────

const filterUpdateSchema = z.object({
  filter: filterBodySchema,
  filterId: z.string(),
});

interface FilterPrevState {
  fk_column_id?: string | null;
  comparison_op?: string | null;
  comparison_sub_op?: string | null;
  value?: string | null;
  fk_parent_id?: string | null;
  // `BoolType` (= boolean | 0 | 1) — matches Filter model's storage.
  is_group?: BoolType;
  logical_op?: string | null;
  fk_value_col_id?: string | null;
  meta?: unknown;
  order?: number | null;
  enabled?: BoolType;
}

interface FilterUpdateExtra {
  fieldTitle?: string;
  tableTitle?: string;
  prevFilter?: FilterPrevState;
}

export const FilterUpdateContract: OperationContract<
  typeof filterUpdateSchema,
  FilterUpdateExtra
> = {
  name: OperationName.filterUpdate,
  version: 1,
  entity: MetaTable.FILTER_EXP,
  schema: filterUpdateSchema,
  entityId: (p) => p?.filterId,
  description: filterActions.edit,
  resolveCtx: async (context, param) => {
    const filter = await Filter.get(context, param?.filterId);
    if (!filter) return {};
    const view = filter.fk_view_id
      ? await View.get(context, filter.fk_view_id)
      : undefined;
    const table = view?.fk_model_id
      ? await Model.get(context, view.fk_model_id)
      : undefined;
    const colId = param?.filter?.fk_column_id ?? filter.fk_column_id;
    const field = colId
      ? await Column.get(context, { colId: colId as string })
      : undefined;
    return {
      parentEntityTitle: view?.title,
      extra: {
        fieldTitle: field?.title,
        tableTitle: table?.title,
        // Snapshot the exact set of mutable fields. Reorder is a special
        // case of update (just `order` changes) — captured here too.
        prevFilter: {
          fk_column_id: filter.fk_column_id,
          comparison_op: filter.comparison_op,
          comparison_sub_op: filter.comparison_sub_op,
          value: filter.value,
          fk_parent_id: filter.fk_parent_id,
          is_group: filter.is_group,
          logical_op: filter.logical_op,
          fk_value_col_id: filter.fk_value_col_id,
          meta: filter.meta,
          order: filter.order,
          enabled: filter.enabled,
        },
      },
    };
  },
  deps: (p, r) => {
    const colId = r?.fk_column_id ?? p?.filter?.fk_column_id;
    return colId ? [{ entity: MetaTable.COLUMNS, id: colId as string }] : [];
  },
  // Undo: re-apply the pre-update filter body captured in resolveCtx.
  buildInverse: (_ctx, p, _r, resolved) => {
    const prev = resolved?.extra?.prevFilter;
    if (!prev) return null;
    return {
      name: OperationName.filterUpdate,
      version: 1,
      params: { filterId: p.filterId, filter: prev },
    };
  },
};

// ─── filterDelete ────────────────────────────────────────────────────────────

const filterDeleteSchema = z.object({
  filterId: z.string(),
});

interface FilterDeleteExtra {
  fieldTitle?: string;
  tableTitle?: string;
  deletedTree?: FilterType;
}

/**
 * Walk a filter and its descendants into a serializable tree. Reads via
 * `getChildren` which is cache-aware and ordered. `Filter.insert` will
 * recursively walk the returned `children` array on undo.
 */
async function snapshotFilterTree(
  context: NcContext,
  filter: Filter,
): Promise<FilterType> {
  const children = filter.is_group
    ? (await filter.getChildren(context)) ?? []
    : [];
  const childNodes = await Promise.all(
    children.map((child) => snapshotFilterTree(context, child as Filter)),
  );
  // `Filter` already implements `FilterType` — spread the row and attach
  // the recursive snapshot. Children are explicit (not just `filter.children`)
  // so we always get the freshly-walked tree even when the in-memory filter
  // had a partial `children` cache.
  return {
    ...(filter as FilterType),
    ...(childNodes.length ? { children: childNodes } : {}),
  };
}

export const FilterDeleteContract: OperationContract<
  typeof filterDeleteSchema,
  FilterDeleteExtra
> = {
  name: OperationName.filterDelete,
  version: 1,
  entity: MetaTable.FILTER_EXP,
  schema: filterDeleteSchema,
  entityId: (p) => p?.filterId,
  description: filterActions.delete,
  resolveCtx: async (context, param) => {
    const filter = await Filter.get(context, param?.filterId);
    if (!filter) return {};
    const view = filter.fk_view_id
      ? await View.get(context, filter.fk_view_id)
      : undefined;
    const table = view?.fk_model_id
      ? await Model.get(context, view.fk_model_id)
      : undefined;
    const field = filter.fk_column_id
      ? await Column.get(context, { colId: filter.fk_column_id })
      : undefined;
    return {
      parentEntityTitle: view?.title,
      extra: {
        fieldTitle: field?.title,
        tableTitle: table?.title,
        // Capture the entire subtree before deletion. The recursive walk
        // matches `Filter.delete`'s recursion so nothing the delete drops
        // is missed by undo.
        deletedTree: await snapshotFilterTree(context, filter),
      },
    };
  },
  // Undo: recreate the filter (and its children, if any). Phase 2 supports
  // view-scoped filters only — that's what the GUI uses. Hook / row-color /
  // RLS / button-column filters return `null` here so undo is a no-op for
  // those flows (they aren't reached from Cmd-Z anyway).
  buildInverse: (_ctx, _p, _r, resolved) => {
    const tree = resolved?.extra?.deletedTree;
    if (!tree?.fk_view_id) return null;
    return {
      name: OperationName.filterCreate,
      version: 1,
      // `Filter.insert` recursively walks `children`. Each level honors
      // pre-set `id` (via `extractProps`) and pre-set `order` (via the
      // `is_replay` guard), so the entire subtree comes back identical.
      params: { viewId: tree.fk_view_id, filter: tree },
    };
  },
};

// ─── linkFilterCreate ─────────────────────────────────────────────────────────

const linkFilterCreateSchema = z.object({
  filter: filterBodySchema,
  columnId: z.string(),
});

export const LinkFilterCreateContract: OperationContract<
  typeof linkFilterCreateSchema
> = {
  name: OperationName.linkFilterCreate,
  version: 1,
  entity: MetaTable.FILTER_EXP,
  schema: linkFilterCreateSchema,
  idField: 'filter',
  entityId: 'id',
  parentId: (p) => p?.columnId,
  description: ({ parentEntityTitle, extra }) => {
    const parts: string[] = ['Add filter'];
    if (extra?.fieldTitle)
      parts.push(`on ${bField(extra.fieldTitle as string)}`);
    if (parentEntityTitle) parts.push(`for link ${bField(parentEntityTitle)}`);
    return parts.join(' ');
  },
  resolveCtx: async (context, param) => {
    const linkCol = param?.columnId
      ? await Column.get(context, { colId: param.columnId })
      : undefined;
    const field = param?.filter?.fk_column_id
      ? await Column.get(context, {
          colId: param.filter.fk_column_id as string,
        })
      : undefined;
    return {
      parentEntityTitle: linkCol?.title,
      extra: { fieldTitle: field?.title },
    };
  },
  deps: (p, r) => {
    const colId = r?.fk_column_id ?? p?.filter?.fk_column_id;
    const linkColId = p?.columnId;
    const deps: TraceCommandDep[] = [];
    if (colId) deps.push({ entity: MetaTable.COLUMNS, id: colId as string });
    if (linkColId) deps.push({ entity: MetaTable.COLUMNS, id: linkColId });
    return deps;
  },
};

// ─── widgetFilterCreate ───────────────────────────────────────────────────────

const widgetFilterCreateSchema = z.object({
  filter: filterBodySchema,
  widgetId: z.string(),
});

export const WidgetFilterCreateContract: OperationContract<
  typeof widgetFilterCreateSchema
> = {
  name: OperationName.widgetFilterCreate,
  version: 1,
  entity: MetaTable.FILTER_EXP,
  schema: widgetFilterCreateSchema,
  idField: 'filter',
  entityId: 'id',
  parentId: (p) => p?.widgetId,
  description: ({ parentEntityTitle, extra }) => {
    const parts: string[] = ['Add filter'];
    if (extra?.fieldTitle)
      parts.push(`on ${bField(extra.fieldTitle as string)}`);
    if (parentEntityTitle) parts.push(`for ${bWidget(parentEntityTitle)}`);
    return parts.join(' ');
  },
  resolveCtx: async (context, param) => {
    const widget = param?.widgetId
      ? await Widget.get(context, param.widgetId)
      : undefined;
    const field = param?.filter?.fk_column_id
      ? await Column.get(context, {
          colId: param.filter.fk_column_id as string,
        })
      : undefined;
    return {
      parentEntityTitle: widget?.title,
      extra: { fieldTitle: field?.title },
    };
  },
  deps: (p, r) => {
    const colId = r?.fk_column_id ?? p?.filter?.fk_column_id;
    return colId ? [{ entity: MetaTable.COLUMNS, id: colId as string }] : [];
  },
};

// ─── rowColorConditionsCreate ─────────────────────────────────────────────────

const rowColorConditionsCreateSchema = z.object({
  rowColorConditionsId: z.string(),
  filter: filterBodySchema,
});

export const RowColorConditionsCreateContract: OperationContract<
  typeof rowColorConditionsCreateSchema
> = {
  name: OperationName.rowColorConditionsCreate,
  version: 1,
  entity: MetaTable.FILTER_EXP,
  schema: rowColorConditionsCreateSchema,
  idField: 'filter',
  entityId: 'id',
  parentId: (p) => p?.rowColorConditionsId,
  description: rowColorConditionActions.add,
  resolveCtx: async (context, param) => {
    const condition = param?.rowColorConditionsId
      ? await RowColorCondition.getById(context, param.rowColorConditionsId)
      : undefined;
    const view = condition?.fk_view_id
      ? await View.get(context, condition.fk_view_id)
      : undefined;
    const table = view?.fk_model_id
      ? await Model.get(context, view.fk_model_id)
      : undefined;
    const field = param?.filter?.fk_column_id
      ? await Column.get(context, {
          colId: param.filter.fk_column_id as string,
        })
      : undefined;
    return {
      parentEntityTitle: view?.title,
      extra: { fieldTitle: field?.title, tableTitle: table?.title },
    };
  },
  deps: (p, r) => {
    const colId = r?.fk_column_id ?? p?.filter?.fk_column_id;
    return colId ? [{ entity: MetaTable.COLUMNS, id: colId as string }] : [];
  },
};
