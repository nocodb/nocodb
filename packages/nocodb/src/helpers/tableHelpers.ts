import {
  type ColumnType,
  extractRolesObj,
  getProjectRole,
  type NcContext,
  PermissionEntity,
  PermissionGrantedType,
  PermissionKey,
  PermissionRole,
  ProjectRoles,
  ViewLockType,
} from 'nocodb-sdk';
import type { UITypes, UserType } from 'nocodb-sdk';
import type { User } from '~/models';
import { Permission, View } from '~/models';
import {
  deleteColumnSystemPropsFromRequest,
  type OperationSource,
  TableSystemColumns,
} from '~/helpers/columnHelpers';
import {
  getUniqueColumnAliasName,
  getUniqueColumnName,
} from '~/helpers/getUniqueName';
import { DriverClient } from '~/utils/nc-config';
import { isEE } from '~/utils';

export const repopulateCreateTableSystemColumns = (
  _context: NcContext,
  {
    columns,
    clientType,
    isMeta = true,
    operationSource,
  }: {
    columns: (ColumnType & { cn?: string })[];
    clientType: DriverClient;
    isMeta?: boolean;
    operationSource?: OperationSource;
  },
) => {
  const tableSystemColumns = TableSystemColumns(
    isEE && clientType === DriverClient.PG,
    isMeta,
  );

  // check meta column support and filter out

  const strictOneColumnUidt = tableSystemColumns
    .filter((col) => !col.allowNonSystem)
    .map((col) => col.uidt);

  const result = [
    ...tableSystemColumns.map((col) => {
      delete col.allowNonSystem;
      (col as any).cn = col.column_name;
      return col as ColumnType & { cn?: string };
    }),
    // remove all UIDT ID and Order from request
    ...columns.filter(
      (col) => !strictOneColumnUidt.includes(col.uidt as UITypes),
    ),
  ];
  for (let i = result.length - 1; i >= tableSystemColumns.length; i--) {
    const col = result[i];
    // check if title, column name or uidt is intersecting with system columns
    const intersectingSystemCols = tableSystemColumns.filter(
      (sysCol) =>
        sysCol.title === col.title || sysCol.column_name === col.column_name,
    );
    for (const sysCol of intersectingSystemCols) {
      if (
        sysCol.uidt === col.uidt &&
        // Match by column_name, or when column_name is absent,
        // or fall back to title match as a last resort
        (sysCol.column_name === col.column_name ||
          col.column_name === undefined ||
          (sysCol.title === col.title && col.title !== undefined))
      ) {
        // identic with system cols, so we remove it
        result.splice(i, 1);
        continue;
      }
      if (col.title && col.title === sysCol.title) {
        col.title = getUniqueColumnAliasName(result as any[], col.title);
      }
      if (col.column_name && col.column_name === sysCol.column_name) {
        col.column_name = getUniqueColumnName(result as any[], col.column_name);
        col.cn = col.column_name;
      }
    }
    deleteColumnSystemPropsFromRequest(col, { operationSource });
  }
  return result;
};

/**
 * Check if a table has default table visibility (Everyone)
 * Returns true if no TABLE_VISIBILITY permission exists (defaults to Everyone)
 * When "Everyone" is selected in UI, the permission record is deleted,
 * so no permission = Everyone = default visibility
 */
export function hasDefaultTableVisibility(
  tableId: string,
  permissions: Permission[],
): boolean {
  // Find TABLE_VISIBILITY permission for this table
  const visibilityPermission = permissions.find(
    (p) =>
      p.entity === PermissionEntity.TABLE &&
      p.entity_id === tableId &&
      p.permission === PermissionKey.TABLE_VISIBILITY,
  );

  // If no permission exists, it defaults to Everyone (default visibility)
  // When "Everyone" is selected in UI, the permission is deleted
  return !visibilityPermission;
}

/**
 * Check if a table has "Viewers & up" table visibility
 * Returns true if the TABLE_VISIBILITY permission is set to "Viewers & up"
 * (granted_type: 'role', granted_role: 'viewer')
 */
export function hasViewersAndUpTableVisibility(
  tableId: string,
  permissions: Permission[],
): boolean {
  // Find TABLE_VISIBILITY permission for this table
  const visibilityPermission = permissions.find(
    (p) =>
      p.entity === PermissionEntity.TABLE &&
      p.entity_id === tableId &&
      p.permission === PermissionKey.TABLE_VISIBILITY,
  );

  // Check if permission is "Viewers & up" (granted_type: 'role', granted_role: 'viewer')
  if (visibilityPermission) {
    return (
      visibilityPermission.granted_type === PermissionGrantedType.ROLE &&
      visibilityPermission.granted_role === PermissionRole.VIEWER
    );
  }

  return false;
}

/**
 * Check if user has access to a table based on TABLE_VISIBILITY permission
 * Base owners always have access
 */
export async function hasTableVisibilityAccess(
  context: NcContext,
  tableId: string,
  user: User | UserType,
  permissions?: Permission[],
): Promise<boolean> {
  // Get permissions if not provided
  if (!permissions) {
    if (!context.permissions)
      context.permissions = await Permission.list(context, context.base_id);
    permissions = context.permissions;
  }

  // if user not defined then check if table have default visibility for all users
  if (!user) {
    return hasDefaultTableVisibility(tableId, context.permissions);
  }

  // Base owners always have access
  // Check base_roles (can be string or object)
  const baseRoles = extractRolesObj((user as any)?.base_roles);
  if (baseRoles?.[ProjectRoles.OWNER]) {
    return true;
  }

  // Also check roles object for backward compatibility
  const roles = extractRolesObj((user as any)?.roles);
  if (roles?.[ProjectRoles.OWNER]) {
    return true;
  }

  // Find TABLE_VISIBILITY permission for this table
  const visibilityPermission = permissions.find(
    (p) =>
      p.entity === PermissionEntity.TABLE &&
      p.entity_id === tableId &&
      p.permission === PermissionKey.TABLE_VISIBILITY,
  );

  // If no permission exists, default to everyone (accessible)
  if (!visibilityPermission) {
    return true;
  }

  // Get the user's project role (base role)
  // Use getProjectRole from nocodb-sdk which extracts the role from user object
  // It looks at user.base_roles and returns the most powerful role
  const userRole = getProjectRole(user) as ProjectRoles;

  // If no role found, user doesn't have access
  if (!userRole) {
    return false;
  }

  // Check if user has permission
  return await Permission.isAllowed(context, visibilityPermission, {
    id: user.id,
    role: userRole,
  });
}

/**
 * Check if user has access to a view based on VIEW_VISIBILITY permission AND
 * the view's parent section's VIEW_SECTION_VISIBILITY permission (cascade S2).
 *
 * - Base owners always have access.
 * - Personal-view owners always have access to their own view AND its parent
 *   section, regardless of either restriction — they can never lock themselves
 *   out (D8 + S3).
 * - If no permission rows exist at either level, defaults to all base members.
 */
export async function hasViewVisibilityAccess(
  context: NcContext,
  viewId: string,
  user: User | UserType,
  permissions?: Permission[],
): Promise<boolean> {
  if (!permissions) {
    if (!context.permissions)
      context.permissions = await Permission.list(context, context.base_id);
    permissions = context.permissions;
  }

  const viewPermission = permissions.find(
    (p) =>
      p.entity === PermissionEntity.VIEW &&
      p.entity_id === viewId &&
      p.permission === PermissionKey.VIEW_VISIBILITY,
  );

  // Fast path: are there any section permissions in this base at all?
  // If not, skip the section lookup (and the view fetch it requires).
  const hasAnySectionPermission = permissions.some(
    (p) => p.entity === PermissionEntity.VIEW_SECTION,
  );

  // Anonymous request — only the existence of a restricting row matters.
  if (!user) {
    if (viewPermission) return false;
    if (!hasAnySectionPermission) return true;
    const view = await View.get(context, viewId);
    if (!view?.fk_view_section_id) return true;
    const sectionPermission = permissions.find(
      (p) =>
        p.entity === PermissionEntity.VIEW_SECTION &&
        p.entity_id === view.fk_view_section_id &&
        p.permission === PermissionKey.VIEW_SECTION_VISIBILITY,
    );
    return !sectionPermission;
  }

  // Base owners always have access.
  const baseRoles = extractRolesObj((user as any)?.base_roles);
  if (baseRoles?.[ProjectRoles.OWNER]) {
    return true;
  }

  const roles = extractRolesObj((user as any)?.roles);
  if (roles?.[ProjectRoles.OWNER]) {
    return true;
  }

  // No restricting row at either level — default access.
  if (!viewPermission && !hasAnySectionPermission) {
    return true;
  }

  // Fetch the view once for personal-view-owner check + section lookup.
  const view = await View.get(context, viewId);

  // Personal-view owner exemption (D8 + S3): owner is exempt from both
  // view-level AND section-level restrictions on their own view.
  if (
    view?.lock_type === ViewLockType.Personal &&
    view.owned_by &&
    view.owned_by === user.id
  ) {
    return true;
  }

  const userRole = getProjectRole(user) as ProjectRoles;

  if (!userRole) {
    return false;
  }

  if (viewPermission) {
    const allowed = await Permission.isAllowed(context, viewPermission, {
      id: user.id,
      role: userRole,
    });
    if (!allowed) return false;
  }

  if (view?.fk_view_section_id) {
    const sectionPermission = permissions.find(
      (p) =>
        p.entity === PermissionEntity.VIEW_SECTION &&
        p.entity_id === view.fk_view_section_id &&
        p.permission === PermissionKey.VIEW_SECTION_VISIBILITY,
    );
    if (sectionPermission) {
      const allowed = await Permission.isAllowed(context, sectionPermission, {
        id: user.id,
        role: userRole,
      });
      if (!allowed) return false;
    }
  }

  return true;
}

/**
 * Check if user has access to a view section based on VIEW_SECTION_VISIBILITY.
 *
 * Sections have no per-section owner concept (unlike personal views), so the
 * only "free pass" is base ownership. The personal-view-owner exemption (S3)
 * does NOT apply here — it's resolved when listing views: if an owner has at
 * least one accessible view inside the section, the section is rendered for
 * them via the "section has any accessible view" gate in the sections list
 * (S5), independently of this function.
 */
export async function hasViewSectionAccess(
  context: NcContext,
  sectionId: string,
  user: User | UserType,
  permissions?: Permission[],
): Promise<boolean> {
  if (!permissions) {
    if (!context.permissions)
      context.permissions = await Permission.list(context, context.base_id);
    permissions = context.permissions;
  }

  const visibilityPermission = permissions.find(
    (p) =>
      p.entity === PermissionEntity.VIEW_SECTION &&
      p.entity_id === sectionId &&
      p.permission === PermissionKey.VIEW_SECTION_VISIBILITY,
  );

  // No permission row exists — default access.
  if (!visibilityPermission) {
    return true;
  }

  if (!user) {
    return false;
  }

  const baseRoles = extractRolesObj((user as any)?.base_roles);
  if (baseRoles?.[ProjectRoles.OWNER]) {
    return true;
  }

  const roles = extractRolesObj((user as any)?.roles);
  if (roles?.[ProjectRoles.OWNER]) {
    return true;
  }

  const userRole = getProjectRole(user) as ProjectRoles;

  if (!userRole) {
    return false;
  }

  return await Permission.isAllowed(context, visibilityPermission, {
    id: user.id,
    role: userRole,
  });
}
