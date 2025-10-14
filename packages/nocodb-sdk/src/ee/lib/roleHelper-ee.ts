import { OrderedProjectRoles, OrderedWorkspaceRoles } from '~/lib/enums';
import type { WorkspaceUserRoles, ProjectRoles } from '~/lib/enums';

/**
 * Get the power of the project role of the user.
 * @param user - The user object.
 * @param forbiddenCallback - The forbidden callback.
 * @returns The power of the project role of the user.
 */
export function extractProjectRolePower(
  user: any,
  /**
   * forbiddenCallback is used to keep old function behaviour
   */ forbiddenCallback?: () => void
) {
  const reverseOrderedProjectRoles = [...OrderedProjectRoles].reverse();
  const reverseOrderedWorkspaceRoles = [...OrderedWorkspaceRoles].reverse();

  // get most powerful role of user (TODO moving forward we will confirm that user has only one role)
  let role: string | null = null;
  let power = -1;

  if (user.base_roles) {
    for (const r of Object.keys(user.base_roles)) {
      const ind = reverseOrderedProjectRoles.indexOf(r as ProjectRoles);
      if (ind > power) {
        role = r;
        power = ind;
      }
    }
  } else if (user.workspace_roles) {
    for (const r of Object.keys(user.workspace_roles)) {
      const ind = reverseOrderedWorkspaceRoles.indexOf(r as WorkspaceUserRoles);
      if (ind > power) {
        role = r;
        power = ind;
      }
    }
  } else {
    return -1;
  }

  const ind =
    reverseOrderedProjectRoles.indexOf(role as ProjectRoles) !== -1
      ? reverseOrderedProjectRoles.indexOf(role as ProjectRoles)
      : reverseOrderedWorkspaceRoles.indexOf(role as WorkspaceUserRoles);

  if (ind === -1) {
    forbiddenCallback?.();
  }

  return ind;
}

export function hasMinimumRoleAccess(
  user: any,
  minimumRole: ProjectRoles,
  /**
   * forbiddenCallback is used to keep old function behaviour
   */
  forbiddenCallback?: () => void
): boolean {
  const power = extractProjectRolePower(user, forbiddenCallback);
  const reverseOrderedProjectRoles = [...OrderedProjectRoles].reverse();
  const minimumRoleIndex = reverseOrderedProjectRoles.indexOf(minimumRole);
  return power >= minimumRoleIndex;
}
