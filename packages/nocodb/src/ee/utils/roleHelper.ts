import { OrderedProjectRoles, OrderedWorkspaceRoles } from 'nocodb-sdk';
import { NcError } from 'src/helpers/catchError';
import type { ProjectRoles, WorkspaceUserRoles } from 'nocodb-sdk';

export function getProjectRolePower(user: any) {
  const reverseOrderedProjectRoles = [...OrderedProjectRoles].reverse();
  const reverseOrderedWorkspaceRoles = [...OrderedWorkspaceRoles].reverse();

  // get most powerful role of user (TODO moving forward we will confirm that user has only one role)
  let role = null;
  let power = -1;

  if (user.project_roles) {
    for (const r of Object.keys(user.project_roles)) {
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

export function getWorkspaceRolePower(user: any) {
  const reverseOrderedWorkspaceRoles = [...OrderedWorkspaceRoles].reverse();

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
