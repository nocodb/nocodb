import { ProjectRoles, WorkspaceUserRoles } from 'nocodb-sdk';
import type { MetaService } from '~/meta/meta.service';
import Base from '~/models/Base';
import BaseUser from '~/models/BaseUser';
import WorkspaceUser from '~/models/WorkspaceUser';

/**
 * Handles orphan bases by reassigning ownership to the first workspace owner
 * when a user is removed from the workspace and their bases become orphaned
 *
 * This function addresses the following scenario:
 * 1. User A is invited to workspace as creator/owner
 * 2. User A creates a base and becomes the only owner of that base
 * 3. User A is removed from the workspace
 * 4. The base becomes orphaned (no owners)
 *
 * Solution: Assign ownership to the first workspace owner to prevent orphan bases
 *
 * @param workspaceId - The ID of the workspace
 * @param deletedUserId - The ID of the user being removed
 * @param ncMeta - The metadata service instance
 */
export async function handleOrphanBases(
  workspaceId: string,
  deletedUserId: string,
  ncMeta: MetaService,
) {
  // Get all bases in the workspace
  const workspaceBases = await Base.listByWorkspace(workspaceId, true, ncMeta);

  for (const base of workspaceBases) {
    // Get all base users for this base
    const baseUsers = await BaseUser.getUsersList(
      {
        workspace_id: workspaceId,
        base_id: base.id,
      },
      {
        base_id: base.id,
        include_ws_deleted: true,
      },
      ncMeta,
    );

    // Check if there are any direct owners (excluding the deleted user)
    const directOwners = baseUsers.filter(
      (user) => user.id !== deletedUserId && user.roles === ProjectRoles.OWNER,
    );

    // If no direct owners exist, we need to assign ownership
    if (directOwners.length === 0) {
      // Get workspace owners to assign ownership to the first one
      const workspaceOwners = await WorkspaceUser.userList({
        fk_workspace_id: workspaceId,
        roles: WorkspaceUserRoles.OWNER,
      });

      if (workspaceOwners.length > 0) {
        const firstWorkspaceOwner = workspaceOwners[0];

        // Check if the workspace owner already has a base user entry
        const existingBaseUser = baseUsers.find(
          (user) => user.id === firstWorkspaceOwner.fk_user_id,
        );

        if (existingBaseUser) {
          // Update existing base user to be owner
          await BaseUser.updateRoles(
            {
              workspace_id: workspaceId,
              base_id: base.id,
            },
            base.id,
            firstWorkspaceOwner.fk_user_id,
            ProjectRoles.OWNER,
            ncMeta,
          );
        } else {
          // Create new base user entry for the workspace owner
          await BaseUser.insert(
            {
              workspace_id: workspaceId,
              base_id: base.id,
            },
            {
              base_id: base.id,
              fk_user_id: firstWorkspaceOwner.fk_user_id,
              roles: ProjectRoles.OWNER,
              invited_by: firstWorkspaceOwner.fk_user_id,
            },
            ncMeta,
          );
        }
      }
    }
  }
}

/**
 * Handles orphan bases across all workspaces when a user is completely deleted
 * from the system
 *
 * This function addresses the scenario where a user is completely deleted
 * from the system (not just removed from a workspace), and their bases
 * across multiple workspaces become orphaned.
 *
 * @param deletedUserId - The ID of the user being deleted
 * @param ncMeta - The metadata service instance
 */
export async function handleOrphanBasesAfterUserDeletion(
  deletedUserId: string,
  ncMeta: MetaService,
) {
  // Get all workspaces where the user was a member
  const userWorkspaces = await WorkspaceUser.workspaceList(
    {
      fk_user_id: deletedUserId,
    },
    ncMeta,
  );

  for (const workspace of userWorkspaces) {
    await handleOrphanBases(workspace.id, deletedUserId, ncMeta);
  }
}
