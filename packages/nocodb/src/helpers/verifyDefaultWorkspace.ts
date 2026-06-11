import { WorkspaceUserRoles } from 'nocodb-sdk';
import { Logger } from '@nestjs/common';
import type { User } from '~/models';
import {
  MetaTable,
  NC_STORE_DEFAULT_WORKSPACE_ID_KEY,
  RootScopes,
} from '~/utils/globals';
import { isOnPrem } from '~/utils';
import Noco from '~/Noco';
import WorkspaceUser from '~/models/WorkspaceUser';

const logger = new Logger('verifyDefaultWorkspace');

export const verifyDefaultWorkspace = async (
  user?: User,
  ncMeta = Noco.ncMeta,
) => {
  // Skip for cloud/pure EE — they manage workspaces via EE service.
  // On-prem always needs a default workspace regardless of license state.
  if (Noco.isEE() && !isOnPrem) {
    return;
  }

  // if ws id exists, return
  if (Noco.ncDefaultWorkspaceId) {
    return;
  }
  const ncDefaultWorkspaceId = await ncMeta.metaGet(
    RootScopes.ROOT,
    RootScopes.ROOT,
    MetaTable.STORE,
    {
      key: NC_STORE_DEFAULT_WORKSPACE_ID_KEY,
    },
  );
  // if store has default ws id, we use that
  if (ncDefaultWorkspaceId?.value) {
    Noco.ncDefaultWorkspaceId = ncDefaultWorkspaceId.value;
    return;
  }

  if (!user) {
    // find super user
    const superUser = await ncMeta
      .knexConnection(MetaTable.USERS)
      .where('roles', 'like', '%super%')
      .first();
    // no user created yet, we don't need to init ws
    if (!superUser) {
      return;
    }
    user = superUser;
  }

  // check if there are any records in workspace table
  let workspace = await ncMeta
    .knexConnection(MetaTable.WORKSPACE)
    .orderBy('created_at', 'asc')
    .first();

  if (!workspace) {
    // create workspace if not exists
    workspace = await ncMeta.metaInsert2(
      RootScopes.WORKSPACE,
      RootScopes.WORKSPACE,
      MetaTable.WORKSPACE,
      {
        title: 'Default Workspace',
        fk_user_id: user.id,
        status: 1,
        plan: 'free',
        fk_org_id: null,
      },
    );

    // insert ws user via model so cache is updated
    await WorkspaceUser.insert(
      {
        fk_workspace_id: workspace.id,
        fk_user_id: user.id,
        roles: WorkspaceUserRoles.OWNER,
      },
      ncMeta,
    );
  }

  // insert to store as it won't be exists
  await ncMeta.metaInsert2(
    RootScopes.ROOT,
    RootScopes.ROOT,
    MetaTable.STORE,
    {
      key: NC_STORE_DEFAULT_WORKSPACE_ID_KEY,
      value: workspace.id,
    },
    true,
  );

  Noco.ncDefaultWorkspaceId = workspace.id;
};

export const verifyDefaultWsOwner = async (ncMeta = Noco.ncMeta) => {
  // Skip for cloud/pure EE — on-prem always needs default workspace owner
  if (Noco.isEE() && !isOnPrem) {
    return;
  }

  // find super user
  const user = await ncMeta
    .knexConnection(MetaTable.USERS)
    .where('roles', 'like', '%super%')
    .first();
  // no user created yet, we don't need to init ws
  if (!user) {
    return;
  }

  // if no default ws id present, we verify it first
  if (!Noco.ncDefaultWorkspaceId) {
    await verifyDefaultWorkspace(user, ncMeta);
  }

  // get the user's workspace role
  const workspaceUser = await ncMeta
    .knexConnection(MetaTable.WORKSPACE_USER)
    .where('fk_workspace_id', Noco.ncDefaultWorkspaceId)
    .andWhere('fk_user_id', user.id)
    .first();

  // if no role for user, we assign owner
  if (!workspaceUser) {
    await WorkspaceUser.insert(
      {
        fk_workspace_id: Noco.ncDefaultWorkspaceId,
        fk_user_id: user.id,
        roles: WorkspaceUserRoles.OWNER,
      },
      ncMeta,
    );
  }
  // however if user has workspace role but not owner, we update
  else if (workspaceUser.roles !== WorkspaceUserRoles.OWNER) {
    await WorkspaceUser.update(
      Noco.ncDefaultWorkspaceId,
      user.id,
      { roles: WorkspaceUserRoles.OWNER },
      ncMeta,
    );
  }
};

/**
 * Ensures a user has a workspace_user entry in the default workspace.
 * Used for non-first signups and org-user invites (CE + on-prem).
 * Cloud EE manages workspace membership via its own EE service — skip there.
 *
 * @param userId - The user ID to ensure membership for
 * @param role - Workspace role to assign (default: NO_ACCESS — preserves existing behavior)
 * @param ncMeta - Meta service instance
 */
export const ensureUserInDefaultWorkspace = async (
  userId: string,
  role: WorkspaceUserRoles = WorkspaceUserRoles.NO_ACCESS,
  ncMeta = Noco.ncMeta,
) => {
  // Cloud EE manages workspace membership via its own service
  if (Noco.isEE() && !isOnPrem) return;

  if (!Noco.ncDefaultWorkspaceId) {
    await verifyDefaultWorkspace(undefined, ncMeta);
  }
  if (!Noco.ncDefaultWorkspaceId) return;

  try {
    await WorkspaceUser.insert(
      {
        fk_workspace_id: Noco.ncDefaultWorkspaceId,
        fk_user_id: userId,
        roles: role,
      },
      ncMeta,
    );
  } catch {
    // Already in workspace — ignore duplicate
    logger.debug(`User ${userId} already in default workspace`);
  }
};
