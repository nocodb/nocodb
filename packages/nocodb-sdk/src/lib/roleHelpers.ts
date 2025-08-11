import { WorkspaceRolesToProjectRoles } from '~/lib/enums';

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
