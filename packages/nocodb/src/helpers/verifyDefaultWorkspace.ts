import { WorkspaceUserRoles } from 'nocodb-sdk';
import type { User } from '~/models';
import {
  MetaTable,
  NC_STORE_DEFAULT_WORKSPACE_ID_KEY,
  RootScopes,
} from '~/utils/globals';
import Noco from '~/Noco';
import { isEE } from '~/utils';

export const verifyDefaultWorkspace = async (
  user?: User,
  ncMeta = Noco.ncMeta,
) => {
  // if ee do not need to handle this
  if (isEE) {
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

    // insert ws user
    await ncMeta.metaInsert2(
      RootScopes.WORKSPACE,
      RootScopes.WORKSPACE,
      MetaTable.WORKSPACE_USER,
      {
        fk_workspace_id: workspace.id,
        fk_user_id: user.id,
        roles: WorkspaceUserRoles.OWNER,
      },
      true,
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
  // if ee do not need to handle this
  if (isEE) {
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
    await ncMeta.metaInsert2(
      RootScopes.WORKSPACE,
      RootScopes.WORKSPACE,
      MetaTable.WORKSPACE_USER,
      {
        fk_workspace_id: Noco.ncDefaultWorkspaceId,
        fk_user_id: user.id,
        roles: WorkspaceUserRoles.OWNER,
      },
      true,
    );
  }
  // however if user has workspace role but not owner, we update
  else if (workspaceUser.roles !== WorkspaceUserRoles.OWNER) {
    await ncMeta
      .knexConnection(MetaTable.WORKSPACE)
      .where('fk_workspace_id', Noco.ncDefaultWorkspaceId)
      .andWhere('fk_user_id', user.id)
      .update({
        roles: WorkspaceUserRoles.OWNER,
      });
  }
};
