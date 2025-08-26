import { extractProjectRolePower, hasMinimumRoleAccess } from 'nocodb-sdk';
import { NcError } from 'src/helpers/catchError';
import type { ProjectRoles } from 'nocodb-sdk';

// Re-export getProjectRole from nocodb-sdk to keep backward compatibility
export { getProjectRole } from 'nocodb-sdk';

/**
 * Get the power of the project role of the user.
 * @param user - The user object.
 * @returns The power of the project role of the user.
 */
export function getProjectRolePower(user: any) {
  return extractProjectRolePower(user, () => {
    NcError.badRequest('Forbidden');
  });
}

/**
 * Check if the user has the minimum role to access the resource.
 * @param user - The user object.
 * @param minimumRole - The minimum role to access the resource.
 * @returns True if the user has the minimum role, false otherwise.
 */
export function hasMinimumRole(user: any, minimumRole: ProjectRoles): boolean {
  return hasMinimumRoleAccess(user, minimumRole, () => {
    NcError.badRequest('Forbidden');
  });
}
