import { ProjectRoles, WorkspaceUserRoles } from 'nocodb-sdk';
import type { Knex } from 'knex';
import { MetaTable, NC_STORE_DEFAULT_WORKSPACE_ID_KEY } from '~/utils/globals';

// Role hierarchy for upgrade comparison (higher index = higher privilege)
const WS_ROLE_ORDER = [
  WorkspaceUserRoles.NO_ACCESS,
  WorkspaceUserRoles.VIEWER,
  WorkspaceUserRoles.COMMENTER,
  WorkspaceUserRoles.EDITOR,
  WorkspaceUserRoles.CREATOR,
  WorkspaceUserRoles.OWNER,
];

/**
 * Unify CE roles for the single-docker image.
 *
 * After this migration, workspace-based role inheritance is the access model
 * for both CE and EE on-prem. Org-level roles are ignored.
 *
 * Steps:
 * 1. Resolve the default workspace (idempotent — created by nc_098 on upgrades,
 *    or by verifyDefaultWorkspace() at runtime on fresh installs)
 * 2. Batch-add missing users to the workspace with NO_ACCESS
 * 3. For users whose nc_users_v2.roles contains 'org-level-creator', upgrade
 *    their workspace role to workspace-level-creator if current ws role is lower.
 * 4. For workspace-level-creator users, insert no-access base_user entries
 *    on every existing base they don't already have access to — this blocks
 *    inheritance and preserves the pre-migration access model where bases
 *    were only visible to explicitly assigned users.
 */
const up = async (knex: Knex) => {
  // ── Step 1: Resolve default workspace ID ──────────────────────────────
  let defaultWsId: string | null = null;

  // Check nc_store first
  const storeRow = await knex(MetaTable.STORE)
    .where('key', NC_STORE_DEFAULT_WORKSPACE_ID_KEY)
    .first();

  if (storeRow?.value) {
    defaultWsId = storeRow.value;
  } else {
    // Check if any workspace exists
    const existingWs = await knex(MetaTable.WORKSPACE)
      .orderBy('created_at', 'asc')
      .first();

    if (existingWs) {
      defaultWsId = existingWs.id;
      // Store it so verifyDefaultWorkspace can find it
      await knex(MetaTable.STORE).insert({
        key: NC_STORE_DEFAULT_WORKSPACE_ID_KEY,
        value: defaultWsId,
      });
    }
  }

  // No workspace at all — nothing to migrate.
  // Fresh install: verifyDefaultWorkspace() creates it at runtime on first signup.
  // Upgrade: nc_098 (v2) already created it, so we'd have found it above.
  if (!defaultWsId) {
    return;
  }

  // ── Step 2: Batch-add missing users to workspace with NO_ACCESS ───────
  // Find all users who don't have a workspace_user entry for the default workspace
  const missingUsers = await knex(MetaTable.USERS)
    .leftJoin(MetaTable.WORKSPACE_USER, function () {
      this.on(
        `${MetaTable.USERS}.id`,
        '=',
        `${MetaTable.WORKSPACE_USER}.fk_user_id`,
      ).andOn(
        knex.raw(`?? = ?`, [
          `${MetaTable.WORKSPACE_USER}.fk_workspace_id`,
          defaultWsId,
        ]),
      );
    })
    .whereNull(`${MetaTable.WORKSPACE_USER}.fk_user_id`)
    .select(`${MetaTable.USERS}.id as user_id`);

  if (missingUsers.length) {
    const wsUserRows = missingUsers.map((u) => ({
      fk_workspace_id: defaultWsId,
      fk_user_id: u.user_id,
      roles: WorkspaceUserRoles.NO_ACCESS,
    }));

    // Batch insert in chunks of 100 to avoid parameter limits
    for (let i = 0; i < wsUserRows.length; i += 100) {
      await knex(MetaTable.WORKSPACE_USER).insert(wsUserRows.slice(i, i + 100));
    }
  }

  // ── Step 3: Promote org-level-creators to workspace-level-creator ──
  // For users whose nc_users_v2.roles contains 'org-level-creator',
  // upgrade their workspace_user row to workspace-level-creator only
  // if their current ws role is lower on the hierarchy.
  // Do NOT touch viewers — they keep whatever workspace role they already have.
  // Do NOT strip org roles from nc_users_v2.roles.
  const orgCreators = await knex(MetaTable.USERS)
    .where('roles', 'like', '%org-level-creator%')
    .select('id');

  if (orgCreators.length) {
    const targetIndex = WS_ROLE_ORDER.indexOf(WorkspaceUserRoles.CREATOR);

    for (const orgCreator of orgCreators) {
      const wsUser = await knex(MetaTable.WORKSPACE_USER)
        .where('fk_workspace_id', defaultWsId)
        .where('fk_user_id', orgCreator.id)
        .first();

      if (!wsUser) continue;

      const currentIndex = WS_ROLE_ORDER.indexOf(
        wsUser.roles as WorkspaceUserRoles,
      );

      // Only upgrade if current role is strictly lower
      if (currentIndex < targetIndex) {
        await knex(MetaTable.WORKSPACE_USER)
          .where('fk_workspace_id', defaultWsId)
          .where('fk_user_id', orgCreator.id)
          .update({ roles: WorkspaceUserRoles.CREATOR });
      }
    }
  }

  // ── Step 4: Block inheritance for workspace-level-creators ────────────
  // For users with workspace-level-creator role, insert no-access base_user
  // entries for every base they don't already have access to.
  // This preserves the CE model where only explicitly invited users see a base.
  //
  // Skip workspace-level-owner (super admins) — they see everything anyway.
  const wsCreators = await knex(MetaTable.WORKSPACE_USER)
    .where('fk_workspace_id', defaultWsId)
    .where('roles', WorkspaceUserRoles.CREATOR)
    .select('fk_user_id');

  if (wsCreators.length) {
    // Get all bases in the default workspace
    const bases = await knex(MetaTable.PROJECT)
      .where('fk_workspace_id', defaultWsId)
      .select('id');

    if (bases.length) {
      for (const creator of wsCreators) {
        // Find bases this creator doesn't already have a base_user entry for
        const existingBaseAccess = await knex(MetaTable.PROJECT_USERS)
          .where('fk_user_id', creator.fk_user_id)
          .whereIn(
            'base_id',
            bases.map((b) => b.id),
          )
          .select('base_id');

        const existingBaseIds = new Set(
          existingBaseAccess.map((r) => r.base_id),
        );

        const missingBases = bases.filter((b) => !existingBaseIds.has(b.id));

        if (missingBases.length) {
          const baseUserRows = missingBases.map((b) => ({
            base_id: b.id,
            fk_user_id: creator.fk_user_id,
            roles: ProjectRoles.NO_ACCESS,
            fk_workspace_id: defaultWsId,
          }));

          for (let i = 0; i < baseUserRows.length; i += 100) {
            await knex(MetaTable.PROJECT_USERS).insert(
              baseUserRows.slice(i, i + 100),
            );
          }
        }
      }
    }
  }
};

const down = async (_knex: Knex) => {
  // Intentionally left empty — this migration is not reversible.
  // The no-access entries are harmless if the migration is rolled back.
};

export { up, down };
