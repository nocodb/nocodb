import type { BoolType } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import type { OperationContract } from '~/command-registry/types';
import type { TraceCommandDep } from '~/command-registry/types';
import type { FiltersService } from '~/services/filters.service';
import { OperationName } from '~/command-registry/op-names';
import { registerForward } from '~/command-registry/replay-context';
import {
  scopeBase,
  scopeDashboard,
  scopeTable,
  scopeView,
} from '~/command-registry/scope';
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
import {
  buttonFilterCreateSchema,
  filterBulkLogicalOpUpdateSchema,
  filterCreateSchema,
  filterDeleteSchema,
  filterUpdateSchema,
  linkFilterCreateSchema,
  rowColorConditionsCreateSchema,
  widgetFilterCreateSchema,
} from '~/command-registry/operations/_schemas/filter';
import { pickFilterTreeFields } from '~/command-registry/operations/shared/filter-snapshot';

export const FilterCreateContract: OperationContract<
  typeof filterCreateSchema,
  Record<string, any>,
  Filter | undefined
> = {
  name: OperationName.filterCreate,
  entity: MetaTable.FILTER_EXP,
  schema: filterCreateSchema,
  entry: {
    entity_id: 'id',
    parent_id: 'viewId',
    description: filterActions.add,
    before: async (context, params) => {
      const view = await View.get(context, params?.viewId);
      const field = params?.filter?.fk_column_id
        ? await Column.get(context, {
            colId: params.filter.fk_column_id as string,
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
  },
  sandbox: {
    id_field: 'filter',
    dependencies: (_params, result) =>
      result?.fk_column_id
        ? [{ entity: MetaTable.COLUMNS, id: result.fk_column_id }]
        : [],
  },
  undo: {
    inverse: (_context, _params, result) => {
      if (!result?.id) return null;
      return {
        name: OperationName.filterDelete,
        params: { filterId: result.id },
      };
    },
    scope: (params) => scopeView(params.viewId),
  },
};

interface FilterPrevState {
  fk_column_id?: string;
  comparison_op?: string;
  comparison_sub_op?: string;
  value?: string;
  fk_parent_id?: string;
  is_group?: BoolType;
  logical_op?: string;
  fk_value_col_id?: string;
  meta?: unknown;
  order?: number;
  enabled?: BoolType;
}

interface FilterUpdateExtra {
  fieldTitle?: string;
  tableTitle?: string;
  prevFilter?: FilterPrevState;
}

export const FilterUpdateContract: OperationContract<
  typeof filterUpdateSchema,
  FilterUpdateExtra,
  Filter | undefined
> = {
  name: OperationName.filterUpdate,
  entity: MetaTable.FILTER_EXP,
  schema: filterUpdateSchema,
  entry: {
    entity_id: (params) => params?.filterId,
    description: filterActions.edit,
    before: async (context, params) => {
      const filter = await Filter.get(context, params?.filterId);
      if (!filter) return {};
      const view = filter.fk_view_id
        ? await View.get(context, filter.fk_view_id)
        : undefined;
      const table = view?.fk_model_id
        ? await Model.get(context, view.fk_model_id)
        : undefined;
      const colId = params?.filter?.fk_column_id ?? filter.fk_column_id;
      const field = colId
        ? await Column.get(context, { colId: colId as string })
        : undefined;
      return {
        parentEntityTitle: view?.title,
        extra: {
          fieldTitle: field?.title,
          tableTitle: table?.title,
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
  },
  sandbox: {
    dependencies: (params, result) => {
      const colId = result?.fk_column_id ?? params?.filter?.fk_column_id;
      return colId ? [{ entity: MetaTable.COLUMNS, id: colId as string }] : [];
    },
  },
  undo: {
    inverse: (_context, params, _result, resolved) => {
      const prev = resolved?.extra?.prevFilter;
      if (!prev) return null;
      return {
        name: OperationName.filterUpdate,
        params: { filterId: params.filterId, filter: prev },
      };
    },
    scope: (_p, result, _r, context) =>
      result?.fk_view_id ? scopeView(result.fk_view_id) : scopeBase(context),
  },
};

interface FilterTreeNode extends Record<string, unknown> {
  fk_row_color_condition_id?: string;
  fk_widget_id?: string;
  fk_link_col_id?: string;
  fk_button_col_id?: string;
  fk_view_id?: string;
  fk_hook_id?: string;
}

interface FilterDeleteExtra {
  fieldTitle?: string;
  tableTitle?: string;
  deletedTree?: FilterTreeNode;
}

async function snapshotFilterTree(
  context: NcContext,
  filter: Filter,
): Promise<Record<string, unknown>> {
  const children = filter.is_group
    ? (await filter.getChildren(context)) ?? []
    : [];
  const childNodes = await Promise.all(
    children.map((child) => snapshotFilterTree(context, child as Filter)),
  );
  return pickFilterTreeFields(filter, childNodes);
}

export const FilterDeleteContract: OperationContract<
  typeof filterDeleteSchema,
  FilterDeleteExtra,
  boolean
> = {
  name: OperationName.filterDelete,
  entity: MetaTable.FILTER_EXP,
  schema: filterDeleteSchema,
  entry: {
    entity_id: (params) => params?.filterId,
    description: filterActions.delete,
    before: async (context, params) => {
      const filter = await Filter.get(context, params?.filterId);
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
          deletedTree: await snapshotFilterTree(context, filter),
        },
      };
    },
  },
  undo: {
    // Routes to the matching forward op by parent FK. Hook filters no-op
    // (bundled into `hookCreate` / `hookUpdate`).
    inverse: (_context, _params, _result, resolved) => {
      const tree = resolved?.extra?.deletedTree;
      if (!tree) return null;
      if (tree.fk_row_color_condition_id) {
        return {
          name: OperationName.rowColorConditionsCreate,
          params: {
            rowColorConditionsId: tree.fk_row_color_condition_id,
            filter: tree,
          },
        };
      }
      if ((tree as { fk_rls_policy_id?: string }).fk_rls_policy_id) {
        return {
          name: OperationName.rlsPolicyFilterCreate,
          params: {
            rlsPolicyId: (tree as { fk_rls_policy_id?: string })
              .fk_rls_policy_id,
            filter: tree,
          },
        };
      }
      if ((tree as { fk_widget_id?: string }).fk_widget_id) {
        return {
          name: OperationName.widgetFilterCreate,
          params: {
            widgetId: (tree as { fk_widget_id?: string }).fk_widget_id,
            filter: tree,
          },
        };
      }
      if (tree.fk_link_col_id) {
        return {
          name: OperationName.linkFilterCreate,
          params: { columnId: tree.fk_link_col_id, filter: tree },
        };
      }
      if (tree.fk_button_col_id) {
        return {
          name: OperationName.buttonFilterCreate,
          params: { buttonColId: tree.fk_button_col_id, filter: tree },
        };
      }
      if (tree.fk_view_id) {
        return {
          name: OperationName.filterCreate,
          params: { viewId: tree.fk_view_id, filter: tree },
        };
      }
      return null;
    },
    scope: (_p, _r, resolved, context) => {
      const viewId = (
        resolved?.extra?.deletedTree as { fk_view_id?: string } | undefined
      )?.fk_view_id;
      return viewId ? scopeView(viewId) : scopeBase(context);
    },
  },
};

export const LinkFilterCreateContract: OperationContract<
  typeof linkFilterCreateSchema,
  Record<string, any>,
  Filter | undefined
> = {
  name: OperationName.linkFilterCreate,
  entity: MetaTable.FILTER_EXP,
  schema: linkFilterCreateSchema,
  entry: {
    entity_id: 'id',
    parent_id: (params) => params?.columnId,
    description: ({ parentEntityTitle, extra }) => {
      const parts: string[] = ['Add filter'];
      if (extra?.fieldTitle)
        parts.push(`on ${bField(extra.fieldTitle as string)}`);
      if (parentEntityTitle)
        parts.push(`for link ${bField(parentEntityTitle)}`);
      return parts.join(' ');
    },
    before: async (context, params) => {
      const linkCol = params?.columnId
        ? await Column.get(context, { colId: params.columnId })
        : undefined;
      const field = params?.filter?.fk_column_id
        ? await Column.get(context, {
            colId: params.filter.fk_column_id as string,
          })
        : undefined;
      return {
        parentEntityTitle: linkCol?.title,
        extra: { fieldTitle: field?.title, fkModelId: linkCol?.fk_model_id },
      };
    },
  },
  sandbox: {
    id_field: 'filter',
    dependencies: (params, result) => {
      const colId = result?.fk_column_id ?? params?.filter?.fk_column_id;
      const linkColId = params?.columnId;
      const deps: TraceCommandDep[] = [];
      if (colId) deps.push({ entity: MetaTable.COLUMNS, id: colId as string });
      if (linkColId) deps.push({ entity: MetaTable.COLUMNS, id: linkColId });
      return deps;
    },
  },
  undo: {
    inverse: (_context, _params, result) => {
      if (!result?.id) return null;
      return {
        name: OperationName.filterDelete,
        params: { filterId: result.id },
      };
    },
    scope: (_p, _r, resolved) => scopeTable(resolved?.extra?.fkModelId),
  },
};

export const ButtonFilterCreateContract: OperationContract<
  typeof buttonFilterCreateSchema,
  Record<string, any>,
  Filter | undefined
> = {
  name: OperationName.buttonFilterCreate,
  entity: MetaTable.FILTER_EXP,
  schema: buttonFilterCreateSchema,
  entry: {
    entity_id: 'id',
    parent_id: (params) => params?.buttonColId,
    description: ({ parentEntityTitle, extra }) => {
      const parts: string[] = ['Add filter'];
      if (extra?.fieldTitle)
        parts.push(`on ${bField(extra.fieldTitle as string)}`);
      if (parentEntityTitle)
        parts.push(`for button ${bField(parentEntityTitle)}`);
      return parts.join(' ');
    },
    before: async (context, params) => {
      const buttonCol = params?.buttonColId
        ? await Column.get(context, { colId: params.buttonColId })
        : undefined;
      const field = params?.filter?.fk_column_id
        ? await Column.get(context, {
            colId: params.filter.fk_column_id as string,
          })
        : undefined;
      return {
        parentEntityTitle: buttonCol?.title,
        extra: { fieldTitle: field?.title, fkModelId: buttonCol?.fk_model_id },
      };
    },
  },
  sandbox: {
    id_field: 'filter',
    dependencies: (params, result) => {
      const colId = result?.fk_column_id ?? params?.filter?.fk_column_id;
      const buttonColId = params?.buttonColId;
      const deps: TraceCommandDep[] = [];
      if (colId) deps.push({ entity: MetaTable.COLUMNS, id: colId as string });
      if (buttonColId)
        deps.push({ entity: MetaTable.COLUMNS, id: buttonColId as string });
      return deps;
    },
  },
  undo: {
    inverse: (_context, _params, result) => {
      if (!result?.id) return null;
      return {
        name: OperationName.filterDelete,
        params: { filterId: result.id },
      };
    },
    scope: (_p, _r, resolved) => scopeTable(resolved?.extra?.fkModelId),
  },
};

interface WidgetFilterCreateExtra {
  fieldTitle?: string;
  /** Owning dashboard — captured so `scope` can route the row onto the
   *  dashboard's undo stack without a re-fetch. */
  fkDashboardId?: string;
}

export const WidgetFilterCreateContract: OperationContract<
  typeof widgetFilterCreateSchema,
  WidgetFilterCreateExtra,
  Filter | undefined
> = {
  name: OperationName.widgetFilterCreate,
  entity: MetaTable.FILTER_EXP,
  schema: widgetFilterCreateSchema,
  entry: {
    entity_id: 'id',
    parent_id: (params) => params?.widgetId,
    description: ({ parentEntityTitle, extra }) => {
      const parts: string[] = ['Add filter'];
      if (extra?.fieldTitle)
        parts.push(`on ${bField(extra.fieldTitle as string)}`);
      if (parentEntityTitle) parts.push(`for ${bWidget(parentEntityTitle)}`);
      return parts.join(' ');
    },
    before: async (context, params) => {
      const widget = params?.widgetId
        ? await Widget.get(context, params.widgetId)
        : undefined;
      const field = params?.filter?.fk_column_id
        ? await Column.get(context, {
            colId: params.filter.fk_column_id as string,
          })
        : undefined;
      return {
        parentEntityTitle: widget?.title,
        extra: {
          fieldTitle: field?.title,
          fkDashboardId: widget?.fk_dashboard_id,
        },
      };
    },
  },
  sandbox: {
    id_field: 'filter',
    dependencies: (params, result) => {
      const colId = result?.fk_column_id ?? params?.filter?.fk_column_id;
      return colId ? [{ entity: MetaTable.COLUMNS, id: colId as string }] : [];
    },
  },
  undo: {
    inverse: (_context, _params, result) => {
      if (!result?.id) return null;
      return {
        name: OperationName.filterDelete,
        params: { filterId: result.id },
      };
    },
    scope: (_p, _r, resolved) => scopeDashboard(resolved?.extra?.fkDashboardId),
  },
};

export const RowColorConditionsCreateContract: OperationContract<
  typeof rowColorConditionsCreateSchema,
  Record<string, any>,
  Filter | undefined
> = {
  name: OperationName.rowColorConditionsCreate,
  entity: MetaTable.FILTER_EXP,
  schema: rowColorConditionsCreateSchema,
  entry: {
    entity_id: 'id',
    parent_id: (params) => params?.rowColorConditionsId,
    description: rowColorConditionActions.add,
    before: async (context, params) => {
      const condition = params?.rowColorConditionsId
        ? await RowColorCondition.getById(context, params.rowColorConditionsId)
        : undefined;
      const view = condition?.fk_view_id
        ? await View.get(context, condition.fk_view_id)
        : undefined;
      const table = view?.fk_model_id
        ? await Model.get(context, view.fk_model_id)
        : undefined;
      const field = params?.filter?.fk_column_id
        ? await Column.get(context, {
            colId: params.filter.fk_column_id as string,
          })
        : undefined;
      return {
        parentEntityTitle: view?.title,
        extra: {
          fieldTitle: field?.title,
          tableTitle: table?.title,
          fkViewId: condition?.fk_view_id,
        },
      };
    },
  },
  sandbox: {
    id_field: 'filter',
    dependencies: (params, result) => {
      const colId = result?.fk_column_id ?? params?.filter?.fk_column_id;
      return colId ? [{ entity: MetaTable.COLUMNS, id: colId as string }] : [];
    },
  },
  undo: {
    inverse: (_context, _params, result) => {
      if (!result?.id) return null;
      return {
        name: OperationName.filterDelete,
        params: { filterId: result.id },
      };
    },
    scope: (_p, _r, resolved) => scopeView(resolved?.extra?.fkViewId),
  },
};

interface FilterBulkLogicalOpUpdateExtra {
  prev?: Record<string, string>;
  /** First filter's view id — used by `scope`. The bulk-op UI only flips
   *  logical_op across siblings in one view, so one viewId covers the batch. */
  fkViewId?: string;
}

export const FilterBulkLogicalOpUpdateContract: OperationContract<
  typeof filterBulkLogicalOpUpdateSchema,
  FilterBulkLogicalOpUpdateExtra,
  Filter[] | undefined
> = {
  name: OperationName.filterBulkLogicalOpUpdate,
  entity: MetaTable.FILTER_EXP,
  schema: filterBulkLogicalOpUpdateSchema,
  entry: {
    description: filterActions.edit,
    before: async (context, params) => {
      const prev: Record<string, string> = {};
      let fkViewId: string | undefined;
      for (const { filterId } of params?.filters ?? []) {
        const f = await Filter.get(context, filterId);
        if (f?.logical_op) prev[filterId] = f.logical_op;
        // The bulk UI only ever flips siblings in one view — first hit wins.
        if (!fkViewId && f?.fk_view_id) fkViewId = f.fk_view_id;
      }
      return { extra: { prev, fkViewId } };
    },
  },
  undo: {
    inverse: (_context, params, _result, resolved) => {
      const prev = resolved?.extra?.prev;
      if (!prev) return null;
      const reversed = (params.filters ?? [])
        .map(({ filterId }) => ({
          filterId,
          logical_op: prev[filterId] as 'and' | 'not' | 'or',
        }))
        .filter((f) => !!f.logical_op);
      if (!reversed.length) return null;
      return {
        name: OperationName.filterBulkLogicalOpUpdate,
        params: { filters: reversed },
      };
    },
    scope: (_p, _r, resolved, context) =>
      resolved?.extra?.fkViewId
        ? scopeView(resolved.extra.fkViewId)
        : scopeBase(context),
  },
};

export function registerFilterHandlers(svc: FiltersService): void {
  registerForward(FilterCreateContract, (context, params) =>
    svc.filterCreate(context, params),
  );
  registerForward(FilterUpdateContract, (context, params) =>
    svc.filterUpdate(context, params),
  );
  registerForward(FilterDeleteContract, (context, params) =>
    svc.filterDelete(context, params),
  );
  registerForward(FilterBulkLogicalOpUpdateContract, (context, params) =>
    svc.filterBulkLogicalOpUpdate(context, params),
  );
  registerForward(LinkFilterCreateContract, (context, params) =>
    svc.linkFilterCreate(context, params),
  );
  registerForward(WidgetFilterCreateContract, (context, params) =>
    svc.widgetFilterCreate(context, params),
  );
  registerForward(ButtonFilterCreateContract, (context, params) =>
    svc.buttonFilterCreate(context, params),
  );
  registerForward(RowColorConditionsCreateContract, (context, params) =>
    svc.rowColorConditionsCreate(context, params),
  );
}
