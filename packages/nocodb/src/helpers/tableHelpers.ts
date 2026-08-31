import {
  type ColumnType,
  extractRolesObj,
  getProjectRole,
  type NcContext,
  type OperationSource,
  PermissionEntity,
  PermissionGrantedType,
  PermissionKey,
  PermissionRole,
  ProjectRoles,
} from 'nocodb-sdk';
import type { UITypes, UserType } from 'nocodb-sdk';
import type { User } from '~/models';
import { Model, ModelRoleVisibility, Permission } from '~/models';
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
import { isSharedViewAccess } from '~/helpers/accessSource';

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
 * Whether the caller's role still reaches a table under the CE per-view
 * visibility rules (`ModelRoleVisibility`, the "UI ACL" screen).
 *
 * `getAccessibleTables` drops a table from the LIST once every one of its views
 * is disabled for the role, but the routes that take a table or view id
 * directly never re-applied that decision — so an id learned while access was
 * legitimate (or read off a Link column's `fk_related_model_id`) kept working.
 * Same rule as the list: reachable while ANY view is still enabled for ANY role
 * the caller holds.
 */
export async function hasModelRoleVisibilityAccess(
  context: NcContext,
  tableId: string,
  roles: Record<string, boolean>,
): Promise<boolean> {
  if (roles?.[ProjectRoles.OWNER]) return true;

  // Cheapest gate first — most bases have no UI-ACL rows at all, and this list
  // is cached, so the common request never loads the model or its views.
  const disabledRolesByView = new Map<string, Set<string>>();
  for (const entry of await ModelRoleVisibility.list(
    context,
    context.base_id,
  )) {
    if (!entry.disabled) continue;
    const disabled = disabledRolesByView.get(entry.fk_view_id) ?? new Set();
    disabled.add(entry.role);
    disabledRolesByView.set(entry.fk_view_id, disabled);
  }
  if (!disabledRolesByView.size) return true;

  const callerRoles = Object.values(ProjectRoles).filter(
    (role) => roles?.[role],
  );
  if (!callerRoles.length) return false;

  const model = await Model.get(context, tableId);
  // Unknown table — leave the 404 to the route rather than masking it as a 403.
  if (!model) return true;

  const views = await model.getViews(context);
  if (!views.length) return true;

  return views.some((view) => {
    const disabled = disabledRolesByView.get(view.id);
    return callerRoles.some((role) => !disabled?.has(role));
  });
}

/**
 * Whether a nested-link fetch must collapse the RELATED table to what the link
 * exposes (pk + primary value + the link's custom display column). Two
 * independent access boundaries: the caller lacks TABLE_VISIBILITY on the
 * related table, or the request came through a shared VIEW/form — which
 * publishes one view of one table, so the tables it links to are not published.
 *
 * The second needs its own check: with no user `hasTableVisibilityAccess` falls
 * back to `hasDefaultTableVisibility`, `true` whenever no TABLE_VISIBILITY row
 * exists, so a same-base link on a shared view used to expose the full table.
 * Shared BASE is excluded — authenticated pseudo-user, normal access.
 */
export async function hasLimitedRelatedTableAccess(
  context: NcContext,
  relatedTableId: string,
): Promise<boolean> {
  if (isSharedViewAccess(context)) return true;

  return !(await hasTableVisibilityAccess(
    context,
    relatedTableId,
    context.user,
  ));
}
