import { OrderedProjectRoles, OrderedWorkspaceRoles } from './enums';
import type { ProjectRoles, WorkspaceUserRoles } from './enums';

export function extractProjectRolePower(
  user: any,
  /**
   * forbiddenCallback is used to keep old function behaviour
   */
  forbiddenCallback?: () => void
) {
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
    forbiddenCallback?.();
  }

  return ind;
}

export function getProjectRole(user, inheritFromWorkspace = false) {
  // get most powerful role of user (TODO moving forward we will confirm that user has only one role)
  let role = null;
  let power = -1;

  if (user.base_roles) {
    for (const r of Object.keys(user.base_roles)) {
      const ind = OrderedProjectRoles.indexOf(r as ProjectRoles);
      if (ind > power) {
        role = r;
        power = ind;
      }
    }

    return role;
  } else if (inheritFromWorkspace && user.workspace_roles) {
    for (const r of Object.keys(user.workspace_roles)) {
      const ind = OrderedWorkspaceRoles.indexOf(r as WorkspaceUserRoles);
      if (ind > power) {
        role = r;
        power = ind;
      }
    }

    return role;
  } else {
    return null;
  }
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
