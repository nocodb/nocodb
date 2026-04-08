import { EnterpriseOrgUserRoles } from 'nocodb-sdk';
import { OrgUser } from '~/models';
import WorkspaceUser from '~/ee/models/WorkspaceUser';
import { Team } from '~/ee/models';
import PrincipalAssignment from '~/ee/models/PrincipalAssignment';
import { MetaTable, PrincipalType, ResourceType } from '~/utils/globals';
import {
  handleOrphanBases,
  handleOrphanWorkspace,
} from '~/ee/utils/orphanBaseHandler';
import Noco from '~/Noco';

/**
 * Transactionally remove a user from an org and cascade to all
 * workspaces, workspace teams, and org-level teams.
 *
 * Shared between cloud and on-prem org-users services.
 */
export async function removeUserFromOrgCascade(
  orgId: string,
  userId: string,
  ncMeta = Noco.ncMeta,
) {
  // Find the org admin to transfer ownership if needed
  const orgAdmin = await ncMeta
    .knexConnection(MetaTable.ORG_USERS)
    .where('fk_org_id', orgId)
    .where('roles', EnterpriseOrgUserRoles.ADMIN)
    .whereNot('fk_user_id', userId)
    .where(function () {
      this.where('deleted', false).orWhereNull('deleted');
    })
    .first();

  const transaction = await ncMeta.startTransaction();

  try {
    // Soft-delete from org
    await OrgUser.softDelete(orgId, userId, transaction);

    // Remove from all workspaces in this org
    const orgWorkspaces = await transaction
      .knexConnection(MetaTable.WORKSPACE)
      .where('fk_org_id', orgId)
      .where(function () {
        this.where('deleted', false).orWhereNull('deleted');
      })
      .select('id');

    for (const ws of orgWorkspaces) {
      // Transfer workspace ownership to org admin if user is sole owner
      if (orgAdmin) {
        await handleOrphanWorkspace(
          ws.id,
          userId,
          orgAdmin.fk_user_id,
          transaction,
        );
      }

      await WorkspaceUser.softDelete(ws.id, userId, transaction);

      // Reassign orphan bases to the next workspace owner
      await handleOrphanBases(ws.id, userId, transaction);

      // Remove from all teams in this workspace
      const wsTeams = await Team.list(
        { workspace_id: ws.id, base_id: null },
        { fk_workspace_id: ws.id },
        transaction,
      );

      for (const team of wsTeams) {
        const assignment = await PrincipalAssignment.get(
          { workspace_id: ws.id, base_id: null },
          ResourceType.TEAM,
          team.id,
          PrincipalType.USER,
          userId,
          transaction,
        );
        if (assignment) {
          await PrincipalAssignment.delete(
            { workspace_id: ws.id, base_id: null },
            ResourceType.TEAM,
            team.id,
            PrincipalType.USER,
            userId,
            transaction,
          );
        }
      }
    }

    // Remove from org-level teams
    const orgTeams = await Team.list(
      { workspace_id: null, base_id: null },
      { fk_org_id: orgId },
      transaction,
    );

    for (const team of orgTeams) {
      const assignment = await PrincipalAssignment.get(
        { workspace_id: null, base_id: null },
        ResourceType.TEAM,
        team.id,
        PrincipalType.USER,
        userId,
        transaction,
      );
      if (assignment) {
        await PrincipalAssignment.delete(
          { workspace_id: null, base_id: null },
          ResourceType.TEAM,
          team.id,
          PrincipalType.USER,
          userId,
          transaction,
        );
      }
    }

    await transaction.commit();
  } catch (e) {
    await transaction.rollback();
    throw e;
  }
}
