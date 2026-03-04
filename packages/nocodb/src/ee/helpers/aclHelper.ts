import rolePermissions from '~/utils/acl';

/**
 * Check whether a set of roles grants a specific ACL operation.
 *
 * Mirrors the inline logic used by AclMiddleware and workflow-execution.service.
 * Centralised here so that chat tools, workflows, and any future caller
 * share a single source of truth.
 *
 * @param roles   - Decoded role map, e.g. `{ owner: true, editor: false }`
 * @param operation - ACL operation name, e.g. `'tableCreate'`, `'dataInsert'`
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
