import rolePermissions from '~/utils/acl';

/**
 * Check whether a set of roles grants a specific ACL operation.
 *
 * Caller is responsible for passing the scope-appropriate roles
 * (workspace_roles for workspace scope, base_roles for base scope).
 * The role keys themselves (e.g. 'workspace-level-viewer' vs 'owner')
 * resolve to the correct entries in rolePermissions.
 *
 * @param roles     - Decoded role map, e.g. `{ 'workspace-level-viewer': true }`
 * @param operation - ACL operation name, e.g. `'tableCreate'`, `'workspaceBaseList'`
 */
export function hasPermission(
  roles: Record<string, boolean>,
  operation: string,
): boolean {
  return Object.entries(roles).some(([roleName, hasRole]) => {
    if (!hasRole || !rolePermissions[roleName]) return false;
    const perms = rolePermissions[roleName];
    return (
      perms === '*' ||
      (perms.exclude && !perms.exclude[operation]) ||
      (perms.include && perms.include[operation])
    );
  });
}
