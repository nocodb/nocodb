import { z } from 'zod';
import { MetaTable } from '~/utils/globals';
import { Column, Filter, Model, View } from '~/models';
import RlsPolicy from '~/ee/models/RlsPolicy';
import RowColorCondition from '~/models/RowColorCondition';
import Widget from '~/models/Widget';
import type { OperationContract } from 'src/command-registry/_types';
import {
  bField,
  bRlsPolicy,
  bWidget,
  filterActions,
  rowColorConditionActions,
} from '~/decorators/trace-command-descriptions';
import type { TraceCommandDep } from '~/decorators/trace-command.decorator';

// ─── Reusable sub-schemas ───────────────────────────────────────────────────

const filterBodySchema = z.record(z.unknown());

// ─── filterCreate ────────────────────────────────────────────────────────────

const filterCreateSchema = z.object({
  filter: filterBodySchema,
  viewId: z.string(),
});

export const FilterCreateContract: OperationContract<typeof filterCreateSchema> =
  {
    name: 'filterCreate',
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
      r?.fk_column_id
        ? [{ entity: MetaTable.COLUMNS, id: r.fk_column_id }]
        : [],
  };

// ─── filterUpdate ────────────────────────────────────────────────────────────

const filterUpdateSchema = z.object({
  filter: filterBodySchema,
  filterId: z.string(),
});

export const FilterUpdateContract: OperationContract<typeof filterUpdateSchema> =
  {
    name: 'filterUpdate',
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
        extra: { fieldTitle: field?.title, tableTitle: table?.title },
      };
    },
    deps: (p, r) => {
      const colId = r?.fk_column_id ?? p?.filter?.fk_column_id;
      return colId ? [{ entity: MetaTable.COLUMNS, id: colId as string }] : [];
    },
  };

// ─── filterDelete ────────────────────────────────────────────────────────────

const filterDeleteSchema = z.object({
  filterId: z.string(),
});

export const FilterDeleteContract: OperationContract<typeof filterDeleteSchema> =
  {
    name: 'filterDelete',
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
        extra: { fieldTitle: field?.title, tableTitle: table?.title },
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
  name: 'linkFilterCreate',
  version: 1,
  entity: MetaTable.FILTER_EXP,
  schema: linkFilterCreateSchema,
  idField: 'filter',
  entityId: 'id',
  parentId: (p) => p?.columnId,
  description: ({ parentEntityTitle, extra }) => {
    const parts: string[] = ['Add filter'];
    if (extra?.fieldTitle) parts.push(`on ${bField(extra.fieldTitle as string)}`);
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
  name: 'widgetFilterCreate',
  version: 1,
  entity: MetaTable.FILTER_EXP,
  schema: widgetFilterCreateSchema,
  idField: 'filter',
  entityId: 'id',
  parentId: (p) => p?.widgetId,
  description: ({ parentEntityTitle, extra }) => {
    const parts: string[] = ['Add filter'];
    if (extra?.fieldTitle) parts.push(`on ${bField(extra.fieldTitle as string)}`);
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

// ─── rlsPolicyFilterCreate ────────────────────────────────────────────────────

const rlsPolicyFilterCreateSchema = z.object({
  filter: filterBodySchema,
  rlsPolicyId: z.string(),
});

export const RlsPolicyFilterCreateContract: OperationContract<
  typeof rlsPolicyFilterCreateSchema
> = {
  name: 'rlsPolicyFilterCreate',
  version: 1,
  entity: MetaTable.FILTER_EXP,
  schema: rlsPolicyFilterCreateSchema,
  idField: 'filter',
  entityId: 'id',
  parentId: (p) => p?.rlsPolicyId,
  description: ({ parentEntityTitle, extra }) => {
    const parts: string[] = ['Add filter'];
    if (extra?.fieldTitle) parts.push(`on ${bField(extra.fieldTitle as string)}`);
    if (parentEntityTitle) {
      parts.push(`for ${bRlsPolicy(parentEntityTitle)} RLS policy`);
    } else {
      parts.push('for RLS policy');
    }
    return parts.join(' ');
  },
  resolveCtx: async (context, param) => {
    const policy = param?.rlsPolicyId
      ? await RlsPolicy.get(context, param.rlsPolicyId)
      : undefined;
    const field = param?.filter?.fk_column_id
      ? await Column.get(context, {
          colId: param.filter.fk_column_id as string,
        })
      : undefined;
    return {
      parentEntityTitle: policy?.title,
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
  name: 'rowColorConditionsCreate',
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
