import {
  extractRolesObj,
  OrderedProjectRoles,
  OrderedWorkspaceRoles,
  WorkspaceRolesToProjectRoles,
} from 'nocodb-sdk';
import { NcError } from 'src/helpers/catchError';
import type { ProjectRoles, WorkspaceUserRoles } from 'nocodb-sdk';

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

export function mapWorkspaceRolesObjToProjectRolesObj(wsRoles: any) {
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

export function hasMinimumRole(user: any, minimumRole: ProjectRoles): boolean {
  const power = getProjectRolePower(user);
  const reverseOrderedProjectRoles = [...OrderedProjectRoles].reverse();
  const minimumRoleIndex = reverseOrderedProjectRoles.indexOf(minimumRole);
  return power >= minimumRoleIndex;
}
