import { OrderedProjectRoles } from 'nocodb-sdk';
import { NcError } from 'src/helpers/catchError';
import type { ProjectRoles } from 'nocodb-sdk';

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
