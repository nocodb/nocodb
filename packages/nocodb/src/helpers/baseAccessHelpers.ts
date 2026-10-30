import { getEffectiveBaseRole, ProjectRoles } from 'nocodb-sdk';
import type { WorkspaceUserRoles } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import { Base, BaseUser } from '~/models';

interface BaseUserRoleFields {
  roles?: string;
  base_team_roles?: string | null;
  workspace_roles?: string | null;
  workspace_team_roles?: string | null;
}

/**
 * Base users (team members included where teams exist) whose effective base
 * role is not no-access, e.g. workspace members of a private base are left out.
 */
export async function getUsersWithBaseAccess(
  context: NcContext,
  { baseId, userIds }: { baseId: string; userIds?: string[] },
) {
  const base = await Base.get(context, baseId);
  if (!base) return [];

  const users = await BaseUser.getUsersList(context, {
    base_id: baseId,
    user_ids: userIds,
    include_ws_deleted: false,
    include_team_users: true,
  });

  return users.filter((user) => {
    const u: BaseUserRoleFields = user;
    return (
      getEffectiveBaseRole({
        baseRole: u.roles as ProjectRoles,
        baseTeamRole: u.base_team_roles as ProjectRoles,
        workspaceRole: u.workspace_roles as WorkspaceUserRoles,
        workspaceTeamRole: u.workspace_team_roles as WorkspaceUserRoles,
        defaultBaseRole: base.default_role as ProjectRoles,
      }) !== ProjectRoles.NO_ACCESS
    );
  });
}
