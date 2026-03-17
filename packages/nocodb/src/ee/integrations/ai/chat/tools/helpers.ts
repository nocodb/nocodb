import { UITypes } from 'nocodb-sdk';
import type { ModelMeta } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import type { Column } from '~/models';
import type { LinkToAnotherRecordColumn } from '~/models';
import { NcError } from '~/helpers/catchError';
import { hasTableVisibilityAccess } from '~/helpers/tableHelpers';
import Model from '~/models/Model';
import View from '~/models/View';
import { Dashboard, Widget } from '~/models';
import Noco from '~/Noco';

/**
 * Resolve a table by its title (case-insensitive) within the current base.
 * Enforces TABLE_VISIBILITY permission when context.user is available.
 */
export async function resolveTableByName(
  context: NcContext,
  tableName: string,
  _ncMeta = Noco.ncMeta,
): Promise<Model> {
  const models = await Model.list(context, {
    base_id: context.base_id,
  });

  const lowerName = tableName.toLowerCase();
  const model = models.find((m) => m.title?.toLowerCase() === lowerName);

  if (!model) {
    NcError.get(context).genericNotFound('Table', tableName);
  }

  // Enforce table visibility — returns same "not found" to avoid leaking existence
  if (context.user) {
    const hasAccess = await hasTableVisibilityAccess(
      context,
      model.id,
      context.user,
    );
    if (!hasAccess) {
      NcError.get(context).genericNotFound('Table', tableName);
    }
  }

  return model;
}

function toColumnMeta(columns: Column[]) {
  return columns.map((c) => ({
    id: c.id,
    title: c.title,
    column_name: c.column_name,
    uidt: c.uidt,
    pk: c.pk,
    pv: c.pv,
    system: c.system,
    order: c.order,
    meta: c.meta,
  }));
}

/**
 * Build model metadata: id, title, primaryKeys, columns.
 */
export async function buildModelMeta(
  context: NcContext,
  model: Model,
): Promise<ModelMeta> {
  const columns = await model.getColumns(context);
  const pks = columns.filter((c) => c.pk);

  return {
    id: model.id,
    title: model.title,
    primaryKeys: toColumnMeta(pks),
    columns: toColumnMeta(columns),
  };
}

/**
 * Build `modelMap` + `columnModelMap` for LTAR/Links/Lookup/Rollup columns.
 * Only resolves one level deep (sufficient for UI rendering context).
 */
export async function buildRelatedModelsMeta(
  context: NcContext,
  columns: Column[],
): Promise<{
  modelMap: Record<string, ModelMeta>;
  columnModelMap: Record<string, string>;
}> {
  const modelMap: Record<string, ModelMeta> = {};
  const columnModelMap: Record<string, string> = {};

  // Pass 1: LTAR/Links — resolve related models
  for (const column of columns) {
    if (
      column.uidt !== UITypes.LinkToAnotherRecord &&
      column.uidt !== UITypes.Links
    ) {
      continue;
    }

    try {
      const colOptions =
        column.colOptions ||
        (await column.getColOptions<LinkToAnotherRecordColumn>(context));
      if (!colOptions) continue;

      const { refContext } = (
        colOptions as LinkToAnotherRecordColumn
      ).getRelContext(context);
      const relatedModel = await (
        colOptions as LinkToAnotherRecordColumn
      ).getRelatedTable(refContext);

      const modelId = relatedModel.id;
      columnModelMap[column.id] = modelId;

      if (!modelMap[modelId]) {
        const relCols = await relatedModel.getColumns(refContext);
        const relPks = relCols.filter((c) => c.pk);

        modelMap[modelId] = {
          id: modelId,
          title: relatedModel.title,
          primaryKeys: toColumnMeta(relPks),
          columns: toColumnMeta(relCols),
        };
      }
    } catch {
      // Skip columns whose related model can't be resolved
    }
  }

  // Pass 2: Lookup/Rollup — map to their LTAR's related model
  for (const column of columns) {
    if (column.uidt !== UITypes.Lookup && column.uidt !== UITypes.Rollup) {
      continue;
    }

    try {
      const colOptions =
        column.colOptions || (await column.getColOptions(context));
      const relationColumnId = (colOptions as any)?.fk_relation_column_id;

      if (relationColumnId && columnModelMap[relationColumnId]) {
        columnModelMap[column.id] = columnModelMap[relationColumnId];
      }
    } catch {
      // Skip if colOptions can't be loaded
    }
  }

  return { modelMap, columnModelMap };
}

/**
 * Resolve a view by name (case-insensitive) for a given table.
 * When viewName is omitted, returns the default (first) view.
 */
export async function resolveViewByName(
  context: NcContext,
  model: Model,
  viewName?: string,
): Promise<View> {
  const views = await model.getViews(context);

  if (!viewName) {
    return views[0];
  }

  const lowerName = viewName.toLowerCase();
  const view = views.find((v) => v.title?.toLowerCase() === lowerName);

  if (!view) {
    NcError.get(context).genericNotFound('View', viewName);
  }

  return view;
}

/**
 * Resolve a column by title (case-insensitive) within a table.
 */
export async function resolveColumnByName(
  context: NcContext,
  model: Model,
  fieldName: string,
): Promise<Column> {
  const columns = await model.getColumns(context);

  const lowerName = fieldName.toLowerCase();
  const column = columns.find((c) => c.title?.toLowerCase() === lowerName);

  if (!column) {
    NcError.get(context).fieldNotFound(fieldName);
  }

  return column;
}

/**
 * Resolve the GridViewColumn ID for a given column within a view.
 * Needed for operations like group-by that operate on grid view columns.
 */
export async function resolveGridViewColumnId(
  context: NcContext,
  viewId: string,
  fkColumnId: string,
): Promise<string> {
  const viewColumnId = await View.getViewColumnId(context, {
    viewId,
    colId: fkColumnId,
  });

  if (!viewColumnId) {
    NcError.get(context).genericNotFound(
      'GridViewColumn',
      `column ${fkColumnId} in view ${viewId}`,
    );
  }

  return viewColumnId;
}

/**
 * Get the primary key column title for a model.
 * Returns undefined if no PK column is found.
 */
export async function getPrimaryKeyTitle(
  context: NcContext,
  model: Model,
): Promise<string | undefined> {
  const columns = await model.getColumns(context);
  const pkCol = columns.find((c) => c.pk);
  return pkCol?.title;
}

/**
 * Resolve a dashboard by its title (case-insensitive) within the current base.
 */
export async function resolveDashboardByName(
  context: NcContext,
  dashboardName: string,
): Promise<Dashboard> {
  const dashboards = await Dashboard.list(context, context.base_id);

  const lowerName = dashboardName.toLowerCase();
  const dashboard = dashboards.find(
    (d) => d.title?.toLowerCase() === lowerName,
  );

  if (!dashboard) {
    NcError.get(context).genericNotFound('Dashboard', dashboardName);
  }

  return dashboard;
}

/**
 * Resolve a widget by its title (case-insensitive) within a dashboard.
 */
export async function resolveWidgetByName(
  context: NcContext,
  dashboardId: string,
  widgetName: string,
): Promise<Widget> {
  const widgets = await Widget.list(context, dashboardId);

  const lowerName = widgetName.toLowerCase();
  const widget = widgets.find((w) => w.title?.toLowerCase() === lowerName);

  if (!widget) {
    NcError.get(context).genericNotFound('Widget', widgetName);
  }

  return widget;
}
