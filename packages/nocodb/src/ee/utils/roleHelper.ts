import {
  extractRolesObj,
  OrderedProjectRoles,
  OrderedWorkspaceRoles,
  ProjectRoles,
  WorkspaceRolesToProjectRoles,
} from 'nocodb-sdk';
import { NcError } from 'src/helpers/catchError';
import type { NcContext, WorkspaceUserRoles } from 'nocodb-sdk';
import { Base } from '~/models';

/**
 * Get the power of the project role of the user.
 * @param user - The user object.
 * @returns The power of the project role of the user.
 */
export function getProjectRolePower(user: any) {
  const reverseOrderedProjectRoles = [...OrderedProjectRoles].reverse();
  const reverseOrderedWorkspaceRoles = [...OrderedWorkspaceRoles].reverse();

  // get most powerful role of user (TODO moving forward we will confirm that user has only one role)
  let role = null;
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
    reverseOrderedProjectRoles.indexOf(role) !== -1
      ? reverseOrderedProjectRoles.indexOf(role)
      : reverseOrderedWorkspaceRoles.indexOf(role);

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
  if (!user?.base_roles) {
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
 * Get the power of the workspace role of the user.
 * @param user - The user object.
 * @returns The power of the workspace role of the user.
 */
export function getWorkspaceRolePower(user: any) {
  const reverseOrderedWorkspaceRoles = [...OrderedWorkspaceRoles].reverse();

  if (!user.workspace_roles) {
    return -1;
  }

  // get most powerful role of user (TODO moving forward we will confirm that user has only one role)
  let role = null;
  let power = -1;
  for (const r of Object.keys(user.workspace_roles)) {
    const ind = reverseOrderedWorkspaceRoles.indexOf(r as WorkspaceUserRoles);
    if (ind > power) {
      role = r;
      power = ind;
    }
  }
  const ind = reverseOrderedWorkspaceRoles.indexOf(role);

  if (ind === -1) {
    NcError.badRequest('Forbidden');
  }

  return ind;
}

/**
 * Map the workspace roles object to the project roles object.
 * @param wsRoles - The workspace roles object.
 * @returns The project roles object.
 */
export function mapWorkspaceRolesObjToProjectRolesObj(
  context: NcContext,
  wsRoles: any,
  baseId?: string,
): Record<ProjectRoles, boolean> | null {
  // TODO: later return corresponding ProjectRoles if defaultRole is provided
  //   now we only support private base so return `no-access` role
  if (baseId && wsRoles) {
    const base = await Base.get(context, baseId);
    if (base?.default_role) {
      return { [ProjectRoles.NO_ACCESS]: true } as Record<
        ProjectRoles,
        boolean
      >;
    }
  }

  wsRoles = extractRolesObj(wsRoles);
  let baseRoles = null;
  if (wsRoles) {
    for (const r of Object.keys(wsRoles)) {
      if (!baseRoles) baseRoles = {};
      baseRoles[WorkspaceRolesToProjectRoles[r]] = wsRoles[r];
    }
  }
  return baseRoles;
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
