import { ViewLockType } from 'nocodb-sdk';
import type { NcContext } from 'nocodb-sdk';
import {
  Column,
  Filter,
  FormViewColumn,
  GalleryViewColumn,
  GanttViewColumn,
  GridViewColumn,
  Hook,
  ListViewColumn,
  Model,
  Sort,
  TimelineViewColumn,
  View,
  ViewSection,
} from '~/models';
import RowColorCondition from '~/models/RowColorCondition';
import { NcError } from '~/helpers/catchError';

export const VIEW_KEY = Symbol.for('nc:view');

/**
 * Attach the view to the request when it carries a lock_type the ACL
 * middleware needs to reason about (Personal for owner-specific checks,
 * Locked for the editor + locked-view write gate). The function keeps
 * its historical name for call-site compatibility.
 */
export function markPersonalViewIfNeeded(req: any, view: any) {
  if (
    view &&
    (view.lock_type === ViewLockType.Personal ||
      view.lock_type === ViewLockType.Locked)
  ) {
    req[VIEW_KEY] = view;
  }
}

const TABLE_VISIBILITY_CACHE_KEY = Symbol.for('nc:tableVisibility');

/**
 * The request's table-visibility verdicts. Created on the envelope before a
 * batch fans out, so sub-requests (its prototype children) share it.
 */
export function tableVisibilityCache(req: any): Map<string, Promise<boolean>> {
  if (!req[TABLE_VISIBILITY_CACHE_KEY]) {
    req[TABLE_VISIBILITY_CACHE_KEY] = new Map<string, Promise<boolean>>();
  }
  return req[TABLE_VISIBILITY_CACHE_KEY];
}

/** Memoises `check` per table, user and role set for this request. */
export function memoTableVisibility(
  req: any,
  tableId: string,
  roles: Record<string, boolean>,
  check: () => Promise<boolean>,
): Promise<boolean> {
  const roleKey = Object.keys(roles ?? {})
    .filter((role) => roles[role])
    .sort()
    .join(',');
  const key = `${tableId}|${req.user?.id ?? ''}|${roleKey}`;
  const cache = tableVisibilityCache(req);

  let verdict = cache.get(key);
  if (!verdict) {
    verdict = check();
    cache.set(key, verdict);
    verdict.catch(() => cache.delete(key));
  }
  return verdict;
}

/**
 * Check if the request user is the owner of a personal view
 * attached to the request via VIEW_KEY.
 */
export function checkIsPersonalViewOwner(req: any): boolean {
  return (
    req[VIEW_KEY]?.lock_type === ViewLockType.Personal &&
    req[VIEW_KEY].owned_by === req.user?.id
  );
}

// Permissions that are view-specific operations checked separately
// by personalViewOwnerAllowedPermissions. Excluded from the non-owner
// write restriction check.
const PERSONAL_VIEW_MANAGEMENT_PERMISSIONS = [
  'viewColumnUpdate',
  'viewColumnCreate',
  'hideAllColumns',
  'showAllColumns',
  'gridColumnUpdate',
  'listColumnUpdate',
  'timelineColumnUpdate',
  'gridViewUpdate',
  'formViewUpdate',
  'formColumnUpdate',
  'galleryViewUpdate',
  'kanbanViewUpdate',
  'mapViewUpdate',
  'calendarViewUpdate',
  'timelineViewUpdate',
  'listViewUpdate',
  'viewRowColorConditionAdd',
  'viewRowColorConditionUpdate',
  'viewRowColorConditionDelete',
  'viewRowColorSelectAdd',
  'viewRowColorInfoDelete',
  'rowColorConditionsFilterCreate',
] as const;

// Operations that only personal view owners can perform.
// Non-owners cannot modify filters or sorts on someone else's personal view.
// Other view operations (e.g. view management) are restricted in the UI;
// in the future we plan to include the rest of the view permissions here except data ops.
// Everything else (data ops) is governed by role-based checks.
export const personalViewOwnerOnlyOps = [
  'filterCreate',
  'filterUpdate',
  'filterDelete',
  'filterBulkLogicalOpUpdate',
  'sortCreate',
  'sortUpdate',
  'sortDelete',
];

// Permissions that editors can perform on collaborative views and on personal
// views they own — but NOT on other users' personal views.
//
// The middleware gate only fires when the view IS personal (it reads
// `req[VIEW_KEY]?.lock_type === Personal`). On collaborative views the check
// short-circuits and the caller proceeds to the normal role ACL (editor is
// granted these perms in acl.ts).
//
// viewUpdate/viewDelete are listed here for defense-in-depth. Their
// primary enforcement still lives in the service layer
// (views.service.ts), which has the full view object in hand and can
// reason about nuanced transitions (e.g. collab → locked on the new
// payload). The middleware fires on exactly the same conditions the
// service already blocks, so no behaviour changes — but future
// controllers that hit the ACL without routing through views.service
// still get the gate.
export const editorPersonalViewOnlyPermissions = [
  'sortCreate',
  'sortUpdate',
  'sortDelete',
  'filterCreate',
  'filterUpdate',
  'filterDelete',
  'filterBulkLogicalOpUpdate',
  'viewUpdate',
  'viewDelete',
  'viewColumnsBulkSetVisibility',
  'formColumnBulkUpdate',
  ...PERSONAL_VIEW_MANAGEMENT_PERMISSIONS,
];

// All permissions granted to personal view owners regardless of role.
export const personalViewOwnerAllowedPermissions = [
  'filterList',
  'filterGet',
  'filterChildrenList',
  'filterCreate',
  'filterUpdate',
  'filterDelete',
  'sortList',
  'sortGet',
  'sortCreate',
  'sortUpdate',
  'sortDelete',
  'columnList',
  'viewUpdate',
  'viewDelete',
  'viewColumnUpdate',
  'viewColumnCreate',
  'hideAllColumns',
  'showAllColumns',
  'gridColumnUpdate',
  'listColumnUpdate',
  'timelineColumnUpdate',
  'formColumnUpdate',
  'gridViewUpdate',
  'formViewUpdate',
  'galleryViewUpdate',
  'kanbanViewUpdate',
  'mapViewUpdate',
  'calendarViewUpdate',
  'timelineViewUpdate',
  'listViewUpdate',
  'viewRowColorConditionAdd',
  'viewRowColorConditionUpdate',
  'viewRowColorConditionDelete',
  'viewRowColorSelectAdd',
  'viewRowColorInfoDelete',
  'rowColorConditionsFilterCreate',
];

/**
 * The table a filter belongs to, through whichever table-bound owner it has.
 * Widget and RLS-policy filters (and any other owner) resolve to no table.
 */
export async function resolveFilterTableId(
  context: NcContext,
  filter: Pick<
    Filter,
    | 'fk_view_id'
    | 'fk_row_color_condition_id'
    | 'fk_hook_id'
    | 'fk_parent_column_id'
    | 'fk_link_col_id'
    | 'fk_button_col_id'
  >,
): Promise<string | undefined> {
  let viewId = filter.fk_view_id;
  if (!viewId && filter.fk_row_color_condition_id) {
    viewId = (
      await RowColorCondition.getById(context, filter.fk_row_color_condition_id)
    )?.fk_view_id;
  }
  if (viewId) {
    return (await View.get(context, viewId))?.fk_model_id;
  }

  if (filter.fk_hook_id) {
    return (await Hook.get(context, filter.fk_hook_id))?.fk_model_id;
  }

  const colId =
    filter.fk_parent_column_id ||
    filter.fk_link_col_id ||
    filter.fk_button_col_id;
  if (colId) {
    return (await Column.get(context, { colId }))?.fk_model_id;
  }

  return undefined;
}

type ChildTableResolver = {
  tableOf: (context: NcContext, id: string) => Promise<string | undefined>;
  notFound: (context: NcContext, id: string) => never;
};

const viewTable: ChildTableResolver = {
  // A view slot may carry a table id on some data routes.
  tableOf: async (context, id) =>
    (await View.get(context, id))?.fk_model_id ??
    (await Model.get(context, id))?.id,
  notFound: (context, id) => NcError.get(context).viewNotFound(id),
};

const columnTable: ChildTableResolver = {
  tableOf: async (context, id) =>
    (await Column.get(context, { colId: id }))?.fk_model_id,
  notFound: (context, id) => NcError.get(context).fieldNotFound(id),
};

const filterTable: ChildTableResolver = {
  tableOf: async (context, id) => {
    const filter = await Filter.get(context, id);
    return filter ? resolveFilterTableId(context, filter) : undefined;
  },
  notFound: (context, id) => NcError.get(context).genericNotFound('Filter', id),
};

const tableTable: ChildTableResolver = {
  tableOf: async (context, id) => (await Model.get(context, id))?.id,
  notFound: (context, id) => NcError.get(context).tableNotFound(id),
};

/** A child row that names its view: the table is the view's. */
const viewOwnedTable = (
  get: (
    context: NcContext,
    id: string,
  ) => Promise<{ fk_view_id?: string } | null | undefined>,
  notFound: ChildTableResolver['notFound'],
): ChildTableResolver => ({
  tableOf: async (context, id) => {
    const viewId = (await get(context, id))?.fk_view_id;
    return viewId ? (await View.get(context, viewId))?.fk_model_id : undefined;
  },
  notFound,
});

const viewColumnNotFound: ChildTableResolver['notFound'] = (context, id) =>
  NcError.get(context).fieldNotFound(id);

// Table ids first, so they seed the table and a mismatch is reported on the child.
const CHILD_TABLE_RESOLVERS: Record<string, ChildTableResolver> = {
  tableId: tableTable,
  modelId: tableTable,
  fk_model_id: tableTable,
  viewId: viewTable,
  // v1 alias routes put a view id or title here; a title resolves to nothing and is skipped.
  viewName: viewTable,
  formViewId: viewTable,
  gridViewId: viewTable,
  kanbanViewId: viewTable,
  galleryViewId: viewTable,
  calendarViewId: viewTable,
  mapViewId: viewTable,
  ganttViewId: viewTable,
  fk_gantt_view_id: viewTable,
  columnId: columnTable,
  buttonColId: columnTable,
  filterId: filterTable,
  filterParentId: filterTable,
  sortId: viewOwnedTable(
    (context, id) => Sort.get(context, id),
    (context, id) => NcError.get(context).genericNotFound('Sort', id),
  ),
  rowColorConditionId: viewOwnedTable(
    (context, id) => RowColorCondition.getById(context, id),
    (context, id) =>
      NcError.get(context).genericNotFound('Row color condition', id),
  ),
  gridViewColumnId: viewOwnedTable(
    (context, id) => GridViewColumn.get(context, id),
    viewColumnNotFound,
  ),
  formViewColumnId: viewOwnedTable(
    (context, id) => FormViewColumn.get(context, id),
    viewColumnNotFound,
  ),
  formColumnId: viewOwnedTable(
    (context, id) => FormViewColumn.get(context, id),
    viewColumnNotFound,
  ),
  galleryViewColumnId: viewOwnedTable(
    (context, id) => GalleryViewColumn.get(context, id),
    viewColumnNotFound,
  ),
  listViewColumnId: viewOwnedTable(
    (context, id) => ListViewColumn.get(context, id),
    viewColumnNotFound,
  ),
  timelineViewColumnId: viewOwnedTable(
    (context, id) => TimelineViewColumn.get(context, id),
    viewColumnNotFound,
  ),
  ganttViewColumnId: viewOwnedTable(
    (context, id) => GanttViewColumn.get(context, id),
    viewColumnNotFound,
  ),
  sectionId: {
    tableOf: async (context, id) =>
      (await ViewSection.get(context, id))?.fk_model_id,
    notFound: (context, id) => NcError.get(context).viewSectionNotFound(id),
  },
  hookId: {
    tableOf: async (context, id) => (await Hook.get(context, id))?.fk_model_id,
    notFound: (context, id) => NcError.get(context).hookNotFound(id),
  },
};

/** Query / param keys that address a table. */
export const TABLE_ADDRESSING_KEYS = Object.keys(CHILD_TABLE_RESOLVERS);

/** The one table every id in the sources addresses (seeded by `tableId`); refuses ids of another. */
export async function resolveRequestTable(
  context: NcContext,
  tableId: string | undefined,
  ...sources: Array<Record<string, unknown> | undefined>
): Promise<string | undefined> {
  for (const [key, resolver] of Object.entries(CHILD_TABLE_RESOLVERS)) {
    const ids = sources.flatMap((source) =>
      source?.[key] ? [source[key]].flat() : [],
    );
    for (const id of ids) {
      if (typeof id !== 'string') continue;
      const childTableId = await resolver.tableOf(context, id);
      if (!childTableId) continue;
      if (!tableId) tableId = childTableId;
      else if (childTableId !== tableId) resolver.notFound(context, id);
    }
  }
  return tableId;
}
