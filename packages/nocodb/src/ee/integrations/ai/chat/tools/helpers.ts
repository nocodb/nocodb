import type { NcContext } from '~/interface/config';
import type { Column } from '~/models';
import { NcError } from '~/helpers/catchError';
import { TRUNCATE_RESULT_MAX_LENGTH } from '../constants';
import Model from '~/models/Model';
import View from '~/models/View';
import Noco from '~/Noco';

/**
 * Resolve a table by its title (case-insensitive) within the current base.
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

  return model;
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
 * Falls back to 'Id' if no PK column is found.
 */
export async function getPrimaryKeyTitle(
  context: NcContext,
  model: Model,
): Promise<string> {
  const columns = await model.getColumns(context);
  const pkCol = columns.find((c) => c.pk);
  return pkCol?.title || 'Id';
}

/**
 * Truncate a result to prevent overly large tool responses from blowing up context.
 */
export function truncateResult(
  data: any,
  maxLength = TRUNCATE_RESULT_MAX_LENGTH,
): string {
  const str = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength) + '\n... (truncated)';
}
