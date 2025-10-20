import { WorkspaceUserRoles } from 'nocodb-sdk';
import { customAlphabet } from 'nanoid';
import type { Knex } from 'knex';
import { MetaTable, NC_STORE_DEFAULT_WORKSPACE_ID_KEY } from '~/utils/globals';

const nanoidWorkspace = customAlphabet(
  '1234567890abcdefghijklmnopqrstuvwxyz',
  7,
);

const up = async (knex: Knex) => {
  // fix base types
  await knex(MetaTable.PROJECT)
    .update({
      type: 'database',
    })
    .whereNull('type');

  // check if there are any records in workspace table
  const workspaceCount = await knex(MetaTable.WORKSPACE)
    .count('id', { as: 'count' })
    .first();

  if (!workspaceCount || +workspaceCount.count > 0) {
    return;
  }

  // find super user
  const superUser = await knex(MetaTable.USERS)
    .whereLike('roles', '%super%')
    .first();

  if (!superUser) {
    throw new Error('Super user not found');
  }

  const defaultWorkspaceId = `w${nanoidWorkspace()}`;

  // create workspace
  await knex(MetaTable.WORKSPACE).insert({
    id: defaultWorkspaceId,
    title: 'Default Workspace',
    fk_user_id: superUser.id,
    status: 1,
    plan: 'free',
    fk_org_id: null,
  });

  const workspace = await knex(MetaTable.WORKSPACE)
    .where('id', defaultWorkspaceId)
    .first();

  // create workspace user
  await knex(MetaTable.WORKSPACE_USER).insert({
    fk_workspace_id: workspace.id,
    fk_user_id: superUser.id,
    roles: WorkspaceUserRoles.OWNER,
  });

  // update all records with fk_workspace_id
  const tables = [
    MetaTable.PROJECT,
    MetaTable.MODEL_STAT,
    MetaTable.API_TOKENS,
    MetaTable.AUDIT,
    MetaTable.PROJECT_USERS,
    MetaTable.CALENDAR_VIEW_COLUMNS,
    MetaTable.CALENDAR_VIEW,
    MetaTable.COLUMNS,
    MetaTable.EXTENSIONS,
    MetaTable.FILTER_EXP,
    MetaTable.FORM_VIEW_COLUMNS,
    MetaTable.FORM_VIEW,
    MetaTable.GALLERY_VIEW_COLUMNS,
    MetaTable.GALLERY_VIEW,
    MetaTable.GRID_VIEW_COLUMNS,
    MetaTable.GRID_VIEW,
    MetaTable.HOOK_LOGS,
    MetaTable.HOOKS,
    MetaTable.KANBAN_VIEW_COLUMNS,
    MetaTable.KANBAN_VIEW,
    MetaTable.MAP_VIEW_COLUMNS,
    MetaTable.MAP_VIEW,
    MetaTable.MODELS,
    MetaTable.SORT,
    MetaTable.SOURCES,
    MetaTable.SYNC_LOGS,
    MetaTable.SYNC_SOURCE,
    MetaTable.VIEWS,
    MetaTable.MODEL_ROLE_VISIBILITY,
    MetaTable.COMMENTS,
    MetaTable.COMMENTS_REACTIONS,
    MetaTable.USER_COMMENTS_NOTIFICATIONS_PREFERENCE,
    MetaTable.CALENDAR_VIEW_RANGE,
    MetaTable.COL_BARCODE,
    MetaTable.COL_FORMULA,
    MetaTable.COL_LOOKUP,
    MetaTable.COL_QRCODE,
    MetaTable.COL_RELATIONS,
    MetaTable.COL_ROLLUP,
    MetaTable.COL_SELECT_OPTIONS,
    MetaTable.WORKSPACE_USER,
    MetaTable.SNAPSHOT,
    MetaTable.CUSTOM_URLS,
    MetaTable.SCRIPTS,
    MetaTable.JOBS,
    MetaTable.FILE_REFERENCES,
    MetaTable.INTEGRATIONS_STORE,
    MetaTable.COL_LONG_TEXT,
    MetaTable.DATA_REFLECTION,
    MetaTable.COL_BUTTON,
    MetaTable.SYNC_CONFIGS,
  ];

  for (const table of tables) {
    await knex(table).update({
      fk_workspace_id: defaultWorkspaceId,
    });
  }

  // add other users to workspace as NO_ACCESS
  const users = await knex(MetaTable.USERS).whereNot('id', superUser.id);

  for (const user of users) {
    await knex(MetaTable.WORKSPACE_USER).insert({
      fk_workspace_id: workspace.id,
      fk_user_id: user.id,
      roles: WorkspaceUserRoles.NO_ACCESS,
    });
  }

  await knex(MetaTable.STORE).insert({
    key: NC_STORE_DEFAULT_WORKSPACE_ID_KEY,
    value: defaultWorkspaceId,
  });
};

const down = async (_knex: Knex) => {
  throw new Error('Not implemented');
};

export { up, down };
