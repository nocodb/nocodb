import { OrderedProjectRoles, OrderedWorkspaceRoles } from 'nocodb-sdk';
import { NcError } from 'src/helpers/catchError';

export function getProjectRolePower(user: any) {
  const reverseOrderedProjectRoles = [...OrderedProjectRoles].reverse();
  const reverseOrderedWorkspaceRoles = [...OrderedWorkspaceRoles].reverse();

  // get most powerful role of user (TODO moving forward we will confirm that user has only one role)
  let role = null;
  let power = -1;
  for (const r of user.project_roles ?? user.workspace_roles) {
    const ind = reverseOrderedProjectRoles.indexOf(r);
    if (ind > power) {
      role = r;
      power = ind;
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
