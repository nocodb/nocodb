import { ViewLockType } from 'nocodb-sdk';

export const VIEW_KEY = Symbol.for('nc:view');

/**
 * If the view is a personal view, attach it to the request
 * so ACL middleware can perform ownership checks.
 */
export function markPersonalViewIfNeeded(req: any, view: any) {
  if (view && view.lock_type === ViewLockType.Personal) {
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
  'gridViewUpdate',
  'galleryViewUpdate',
  'kanbanViewUpdate',
  'mapViewUpdate',
  'calendarViewUpdate',
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

// Permissions that editors can only use on their own personal views.
// Includes sort/filter CRUD plus view management operations.
export const editorPersonalViewOnlyPermissions = [
  'sortCreate',
  'sortUpdate',
  'sortDelete',
  'filterCreate',
  'filterUpdate',
  'filterDelete',
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
  'viewColumnUpdate',
  'viewColumnCreate',
  'hideAllColumns',
  'showAllColumns',
  'gridColumnUpdate',
  'gridViewUpdate',
  'galleryViewUpdate',
  'kanbanViewUpdate',
  'mapViewUpdate',
  'calendarViewUpdate',
  'listViewUpdate',
  'viewRowColorConditionAdd',
  'viewRowColorConditionUpdate',
  'viewRowColorConditionDelete',
  'viewRowColorSelectAdd',
  'viewRowColorInfoDelete',
  'rowColorConditionsFilterCreate',
];
