import { ViewLockType } from 'nocodb-sdk';

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
  'viewUpdate',
  'viewDelete',
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
