import {
  OrderedProjectRoles,
  OrderedWorkspaceRoles,
  WorkspaceRolesToProjectRoles,
} from './enums';
import type { ProjectRoles, WorkspaceUserRoles } from './enums';
import { extractRolesObj } from './helperFunctions';

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

/**
 * Get the power of the workspace role of the user.
 * @param user - The user object.
 * @returns The power of the workspace role of the user.
 */
export function extractWorkspaceRolePower(
  user: any,
  /**
   * forbiddenCallback is used to keep old function behaviour
   */ forbiddenCallback?: () => void
) {
  const reverseOrderedWorkspaceRoles = [...OrderedWorkspaceRoles].reverse();

  if (!user.workspace_roles) {
    return -1;
  }

  // get most powerful role of user (TODO moving forward we will confirm that user has only one role)
  let role: string | null = null;
  let power = -1;
  for (const r of Object.keys(user.workspace_roles)) {
    const ind = reverseOrderedWorkspaceRoles.indexOf(r as WorkspaceUserRoles);
    if (ind > power) {
      role = r as WorkspaceUserRoles;
      power = ind;
    }
  }
  const ind = reverseOrderedWorkspaceRoles.indexOf(role as WorkspaceUserRoles);

  if (ind === -1) {
    forbiddenCallback?.();
  }

  return ind;
}

/**
 * Map the workspace roles object to the project roles object.
 * @param wsRoles - The workspace roles object.
 * @returns The project roles object.
 */
export function mapWorkspaceRolesObjToProjectRolesObj(wsRoles: any) {
  wsRoles = extractRolesObj(wsRoles);
  let baseRoles: Record<string, any> | null = null;
  if (wsRoles) {
    for (const r of Object.keys(wsRoles)) {
      if (!baseRoles) baseRoles = {};
      baseRoles[WorkspaceRolesToProjectRoles[r]] = wsRoles[r];
    }
  }
  return baseRoles;
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

// extract corresponding base role from workspace role
export function extractBaseRoleFromWorkspaceRole(
  workspaceRole: string | null | undefined
): string | null {
  if (!workspaceRole) return null;

  let workspaceRoleStr: string;

  if (typeof workspaceRole === 'object') {
    // If workspaceRole is an object, extract the first key
    workspaceRoleStr = Object.keys(workspaceRole)[0];
  } else if (typeof workspaceRole === 'string') {
    // If workspaceRole is a string, use it directly
    workspaceRoleStr = workspaceRole;
  }

  // Extract base role from workspace role
  const baseRole =
    WorkspaceRolesToProjectRoles[
      workspaceRoleStr as keyof typeof WorkspaceRolesToProjectRoles
    ];
  return baseRole || null;
}
