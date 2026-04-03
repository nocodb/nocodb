import type { Knex } from 'knex';
import { EnterpriseOrgUserRoles } from 'nocodb-sdk';
import {
  MetaTable,
  NC_DEFAULT_ORG_ID,
  NC_STORE_DEFAULT_ORG_ID_KEY,
} from '~/utils/globals';

export async function up(knex: Knex) {
  // Step 1: Fix nc_org_users PK — change from fk_org_id only to composite (fk_org_id, fk_user_id)
  const hasOrgUsersTable = await knex.schema.hasTable(MetaTable.ORG_USERS);

  if (hasOrgUsersTable) {
    // Drop existing PK and recreate as composite
    // Knex doesn't support dropPrimary cleanly across all DBs, use raw
    const client = knex.client.config.client;

    if (client === 'pg' || client === 'postgresql') {
      // Check if PK exists before dropping
      const pkResult = await knex.raw(`
        SELECT constraint_name FROM information_schema.table_constraints
        WHERE table_name = 'nc_org_users' AND constraint_type = 'PRIMARY KEY'
      `);

      if (pkResult.rows?.length) {
        await knex.raw(
          `ALTER TABLE ${MetaTable.ORG_USERS} DROP CONSTRAINT ${pkResult.rows[0].constraint_name}`,
        );
      }

      // Add composite PK
      await knex.raw(
        `ALTER TABLE ${MetaTable.ORG_USERS} ADD PRIMARY KEY (fk_org_id, fk_user_id)`,
      );
    } else if (client === 'sqlite3') {
      // SQLite doesn't support ALTER TABLE for PK changes
      // Recreate the table with correct PK
      await knex.raw(`
        CREATE TABLE nc_org_users_new (
          fk_org_id VARCHAR(20) NOT NULL,
          fk_user_id VARCHAR(20) NOT NULL,
          roles VARCHAR(255),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (fk_org_id, fk_user_id)
        )
      `);
      await knex.raw(
        `INSERT OR IGNORE INTO nc_org_users_new SELECT * FROM ${MetaTable.ORG_USERS}`,
      );
      await knex.raw(`DROP TABLE ${MetaTable.ORG_USERS}`);
      await knex.raw(
        `ALTER TABLE nc_org_users_new RENAME TO ${MetaTable.ORG_USERS}`,
      );
    } else {
      // MySQL / MariaDB
      await knex.raw(`ALTER TABLE ${MetaTable.ORG_USERS} DROP PRIMARY KEY`);
      await knex.raw(
        `ALTER TABLE ${MetaTable.ORG_USERS} ADD PRIMARY KEY (fk_org_id, fk_user_id)`,
      );
    }

    // Add index on fk_user_id for reverse lookups
    const hasUserIndex = await knex.schema.hasColumn(
      MetaTable.ORG_USERS,
      'fk_user_id',
    );
    if (hasUserIndex) {
      try {
        await knex.schema.alterTable(MetaTable.ORG_USERS, (table) => {
          table.index(['fk_user_id'], 'nc_org_users_fk_user_id_index');
        });
      } catch {
        // Index might already exist
      }
    }
  }

  // Step 2: Create default org for on-prem / CE (idempotent)
  const existingOrg = await knex(MetaTable.ORG)
    .where('id', NC_DEFAULT_ORG_ID)
    .first();

  if (existingOrg) {
    // Default org already exists — skip
    return;
  }

  // Find super user
  const superUser = await knex(MetaTable.USERS)
    .where('roles', 'like', '%super%')
    .first();

  // No users yet (fresh install) — verifyDefaultOrg() will handle at runtime
  if (!superUser) {
    return;
  }

  // Create default org with fixed ID "nc"
  await knex(MetaTable.ORG).insert({
    id: NC_DEFAULT_ORG_ID,
    title: 'Default Organization',
    fk_user_id: superUser.id,
    deleted: false,
  });

  // Add super user as org owner
  await knex(MetaTable.ORG_USERS).insert({
    fk_org_id: NC_DEFAULT_ORG_ID,
    fk_user_id: superUser.id,
    roles: EnterpriseOrgUserRoles.ADMIN,
  });

  // Link all workspaces with no org to the default org
  await knex(MetaTable.WORKSPACE)
    .whereNull('fk_org_id')
    .update({ fk_org_id: NC_DEFAULT_ORG_ID });

  // Backfill: add all workspace users to org_users (deduplicated)
  const workspaceUsers = await knex(MetaTable.WORKSPACE_USER)
    .distinct('fk_user_id')
    .whereNotNull('fk_user_id');

  for (const wu of workspaceUsers) {
    if (wu.fk_user_id === superUser.id) continue; // Already added as owner

    try {
      await knex(MetaTable.ORG_USERS).insert({
        fk_org_id: NC_DEFAULT_ORG_ID,
        fk_user_id: wu.fk_user_id,
        roles: EnterpriseOrgUserRoles.VIEWER,
      });
    } catch {
      // Duplicate — skip
    }
  }

  // Store default org ID in nc_store
  await knex(MetaTable.STORE).insert({
    key: NC_STORE_DEFAULT_ORG_ID_KEY,
    value: NC_DEFAULT_ORG_ID,
  });

  // Step 3: Backfill cloud orgs — add workspace users to nc_org_users
  // On cloud, orgs already exist but only the owner is in nc_org_users.
  // This adds all workspace members to their org.
  const cloudOrgs = await knex(MetaTable.ORG)
    .whereNot('id', NC_DEFAULT_ORG_ID)
    .select('id');

  for (const org of cloudOrgs) {
    // Find all users in workspaces belonging to this org
    const orgWorkspaceUsers = await knex(MetaTable.WORKSPACE_USER)
      .distinct(`${MetaTable.WORKSPACE_USER}.fk_user_id`)
      .innerJoin(
        MetaTable.WORKSPACE,
        `${MetaTable.WORKSPACE_USER}.fk_workspace_id`,
        `${MetaTable.WORKSPACE}.id`,
      )
      .where(`${MetaTable.WORKSPACE}.fk_org_id`, org.id)
      .whereNotNull(`${MetaTable.WORKSPACE_USER}.fk_user_id`);

    for (const wu of orgWorkspaceUsers) {
      try {
        await knex(MetaTable.ORG_USERS).insert({
          fk_org_id: org.id,
          fk_user_id: wu.fk_user_id,
          roles: EnterpriseOrgUserRoles.VIEWER,
        });
      } catch {
        // Already exists (e.g., owner) — skip
      }
    }
  }
}

export async function down(knex: Knex) {
  // Remove backfilled org users (except owner)
  await knex(MetaTable.ORG_USERS)
    .where('fk_org_id', NC_DEFAULT_ORG_ID)
    .whereNot('roles', EnterpriseOrgUserRoles.ADMIN)
    .del();

  // Unlink workspaces
  await knex(MetaTable.WORKSPACE)
    .where('fk_org_id', NC_DEFAULT_ORG_ID)
    .update({ fk_org_id: null });

  // Remove store entry
  await knex(MetaTable.STORE).where('key', 'NC_DEFAULT_ORG_ID').del();

  // Remove default org
  await knex(MetaTable.ORG).where('id', NC_DEFAULT_ORG_ID).del();
}
