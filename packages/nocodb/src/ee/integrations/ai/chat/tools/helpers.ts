import { UITypes } from 'nocodb-sdk';
import type { ModelMeta } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import type { Column } from '~/models';
import type { DocumentType } from 'nocodb-sdk';
import type { LinkToAnotherRecordColumn } from '~/models';
import { NcError } from '~/helpers/catchError';
import { hasTableVisibilityAccess } from '~/helpers/tableHelpers';
import Model from '~/models/Model';
import View from '~/models/View';
import Document from '~/models/Document';
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
  if (!tableName) {
    NcError.get(context).badRequest(
      'table_name is required. Use list_tables to get valid table names.',
    );
  }

  const models = await Model.list(context, {
    base_id: context.base_id,
  });

  const lowerName = tableName.toLowerCase();

  // Also try matching by ID in case the LLM passed a table_id instead of title
  const model =
    models.find((m) => m.title?.toLowerCase() === lowerName) ||
    models.find((m) => m.id === tableName);

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
  const view =
    views.find((v) => v.title?.toLowerCase() === lowerName) ||
    views.find((v) => v.id === viewName);

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
  if (!fieldName) {
    NcError.get(context).badRequest(
      'field_name is required. Use describe_table to get valid field names.',
    );
  }

  const columns = await model.getColumns(context);

  const lowerName = fieldName.toLowerCase();
  const column =
    columns.find((c) => c.title?.toLowerCase() === lowerName) ||
    columns.find((c) => c.id === fieldName);

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
  if (!dashboardName) {
    NcError.get(context).badRequest(
      'dashboard_name is required. Use list_dashboards to get valid dashboard names.',
    );
  }

  const dashboards = await Dashboard.list(context, context.base_id);

  const lowerName = dashboardName.toLowerCase();
  const dashboard =
    dashboards.find((d) => d.title?.toLowerCase() === lowerName) ||
    dashboards.find((d) => d.id === dashboardName);

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
  if (!widgetName) {
    NcError.get(context).badRequest(
      'widget_name is required. Use list_widgets to get valid widget names.',
    );
  }

  const widgets = await Widget.list(context, dashboardId);

  const lowerName = widgetName.toLowerCase();
  const widget =
    widgets.find((w) => w.title?.toLowerCase() === lowerName) ||
    widgets.find((w) => w.id === widgetName);

  if (!widget) {
    NcError.get(context).genericNotFound('Widget', widgetName);
  }

  return widget;
}

/**
 * Resolve a document by its title (case-insensitive) within the current base.
 * Falls back to matching by ID if title doesn't match.
 *
 * Uses a single flat query against the DOCS table — no tree traversal needed
 * since we're matching by title across all hierarchy levels.
 */
export async function resolveDocumentByName(
  context: NcContext,
  documentName: string,
): Promise<DocumentType> {
  if (!documentName) {
    NcError.get(context).badRequest(
      'document_name is required. Use list_documents to get valid document names.',
    );
  }

  const allDocs = await Document.listLite(context, context.base_id, undefined);

  const lowerName = documentName.toLowerCase();
  const doc =
    allDocs.find((d) => d.title?.toLowerCase() === lowerName) ||
    allDocs.find((d) => d.id === documentName);

  if (!doc) {
    NcError.get(context).genericNotFound('Document', documentName);
  }

  return doc;
}

/**
 * Allowed option keys per V3 field type (from swagger-v3.json FieldOptions).
 * The LLM's Zod schema accepts all options for all types in one object,
 * but the swagger FieldOptions schemas use additionalProperties: false.
 * Strip keys that don't belong to the target type to prevent validation errors.
 */
const DATETIME_OPTIONS = [
  'date_format',
  'time_format',
  '12hr_format',
  'display_timezone',
  'timezone',
  'use_same_timezone_for_all',
];

const ALLOWED_OPTIONS_BY_TYPE: Partial<Record<UITypes, string[]>> = {
  // Text & contact
  [UITypes.LongText]: ['rich_text', 'generate_text_using_ai'],
  [UITypes.PhoneNumber]: ['validation'],
  [UITypes.URL]: ['validation'],
  [UITypes.Email]: ['validation'],
  // Numeric
  [UITypes.Number]: ['locale_string'],
  [UITypes.Decimal]: ['precision'],
  [UITypes.Currency]: ['locale', 'code'],
  [UITypes.Percent]: ['show_as_progress'],
  [UITypes.Duration]: ['duration_format'],
  // Date & time
  [UITypes.Date]: ['date_format'],
  [UITypes.DateTime]: DATETIME_OPTIONS,
  [UITypes.Time]: ['12hr_format'],
  [UITypes.CreatedTime]: DATETIME_OPTIONS,
  [UITypes.LastModifiedTime]: DATETIME_OPTIONS,
  // Selection
  [UITypes.SingleSelect]: ['choices'],
  [UITypes.MultiSelect]: ['choices'],
  [UITypes.Rating]: ['icon', 'max_value', 'color'],
  [UITypes.Checkbox]: ['icon', 'color'],
  // Relationships (include both LLM-facing name keys and API-facing id keys)
  [UITypes.Links]: ['relation_type', 'related_table_id', 'related_table_name'],
  [UITypes.LinkToAnotherRecord]: [
    'relation_type',
    'related_table_id',
    'related_table_name',
  ],
  [UITypes.Lookup]: [
    'related_field_id',
    'related_table_lookup_field_id',
    'related_field_name',
    'lookup_field_name',
  ],
  [UITypes.Rollup]: [
    'related_field_id',
    'related_table_rollup_field_id',
    'rollup_function',
    'related_field_name',
    'rollup_field_name',
  ],
  // Computed
  [UITypes.Formula]: ['formula'],
  [UITypes.Barcode]: [
    'format',
    'barcode_value_field_id',
    'barcode_value_field_name',
  ],
  [UITypes.QrCode]: ['qrcode_value_field_id', 'qrcode_value_field_name'],
  // User
  [UITypes.User]: ['allow_multiple_users'],
  // Button — uses oneOf internally, allow all possible button props
  [UITypes.Button]: [
    'type',
    'formula',
    'label',
    'theme',
    'color',
    'icon',
    'button_hook_id',
    'prompt',
    'integration_id',
    'output_column_ids',
    'script_id',
  ],
};

/**
 * Remove option keys that are not valid for the given field type.
 * Returns a new object with only the allowed keys (or empty object).
 */
export function stripIrrelevantOptions(
  fieldType: string,
  options: Record<string, any>,
): Record<string, any> {
  const allowed = ALLOWED_OPTIONS_BY_TYPE[fieldType as UITypes];
  if (!allowed) {
    // Types with no options (SingleLineText, Attachment, JSON, etc.)
    return {};
  }

  const allowedSet = new Set(allowed);
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(options)) {
    if (allowedSet.has(key)) {
      result[key] = value;
    }
  }
  return result;
}
