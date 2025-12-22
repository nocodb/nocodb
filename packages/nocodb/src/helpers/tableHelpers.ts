import { type ColumnType, type NcContext } from 'nocodb-sdk';
import {
  extractRolesObj,
  getProjectRole,
  PermissionEntity,
  PermissionGrantedType,
  PermissionKey,
  PermissionRole,
  ProjectRoles,
} from 'nocodb-sdk';
import type { UITypes, UserType } from 'nocodb-sdk';
import type { User } from '~/models';
import {
  deleteColumnSystemPropsFromRequest,
  TableSystemColumns,
} from '~/helpers/columnHelpers';
import {
  getUniqueColumnAliasName,
  getUniqueColumnName,
} from '~/helpers/getUniqueName';
import { DriverClient } from '~/utils/nc-config';
import { isEE } from '~/utils';
import { Permission } from '~/models';

export const repopulateCreateTableSystemColumns = (
  _context: NcContext,
  {
    columns,
    clientType,
  }: { columns: (ColumnType & { cn?: string })[]; clientType: DriverClient },
) => {
  const tableSystemColumns = TableSystemColumns(
    isEE && clientType === DriverClient.PG,
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
        (sysCol.title === col.title || col.title === undefined) &&
        (sysCol.column_name === col.column_name ||
          col.column_name === undefined)
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
    deleteColumnSystemPropsFromRequest(col);
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
  const hasPermission = await Permission.isAllowed(
    context,
    visibilityPermission,
    {
      id: user.id,
      role: userRole,
    },
  );

  return hasPermission;
}
