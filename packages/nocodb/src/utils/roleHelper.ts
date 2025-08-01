import { OrderedProjectRoles } from 'nocodb-sdk';
import { NcError } from 'src/helpers/catchError';
import type { ProjectRoles } from 'nocodb-sdk';

/**
 * Get the power of the project role of the user.
 * @param user - The user object.
 * @returns The power of the project role of the user.
 */
export function getProjectRolePower(user: any) {
  const reverseOrderedProjectRoles = [...OrderedProjectRoles].reverse();

  if (!user.base_roles) {
    return -1;
  }

  // get most powerful role of user (TODO moving forward we will confirm that user has only one role)
  let role = null;
  let power = -1;
  for (const r of Object.keys(user.base_roles)) {
    const ind = reverseOrderedProjectRoles.indexOf(r as ProjectRoles);
    if (ind > power) {
      role = r;
      power = ind;
    }
  }

  const ind = reverseOrderedProjectRoles.indexOf(role);

  if (ind === -1) {
    NcError.badRequest('Forbidden');
  }

  return ind;
}

/**
 * Get the most powerful role of the user.
 * @param user - The user object.
 * @returns The most powerful role of the user.
 */
export function getProjectRole(user) {
  if (!user.base_roles) {
    return null;
  }

  // get most powerful role of user (TODO moving forward we will confirm that user has only one role)
  let role = null;
  let power = -1;
  for (const r of Object.keys(user.base_roles)) {
    const ind = OrderedProjectRoles.indexOf(r as ProjectRoles);
    if (ind > power) {
      role = r;
      power = ind;
    }
  }

  return role;
}

/**
 * Check if the user has the minimum role to access the resource.
 * @param user - The user object.
 * @param minimumRole - The minimum role to access the resource.
 * @returns True if the user has the minimum role, false otherwise.
 */
export function hasMinimumRole(user: any, minimumRole: ProjectRoles): boolean {
  const power = getProjectRolePower(user);
  const reverseOrderedProjectRoles = [...OrderedProjectRoles].reverse();
  const minimumRoleIndex = reverseOrderedProjectRoles.indexOf(minimumRole);
  return power >= minimumRoleIndex;
}
