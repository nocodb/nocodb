import { EnterpriseOrgUserRoles } from 'nocodb-sdk';
import type { Knex } from 'knex';
import {
  MetaTable,
  NC_DEFAULT_ORG_ID,
  NC_STORE_DEFAULT_ORG_ID_KEY,
} from '~/utils/globals';

/**
 * Batch insert users into nc_org_users, skipping duplicates.
 * Uses DB-specific syntax for conflict handling.
 */
async function batchInsertOrgUsers(
  knex: Knex,
  orgId: string,
  userIds: string[],
  role: string,
) {
  if (!userIds.length) return;

  // Filter out users already in the org to avoid duplicates
  const existingUsers = await knex(MetaTable.ORG_USERS)
    .where('fk_org_id', orgId)
    .select('fk_user_id');

  const existingSet = new Set(existingUsers.map((u) => u.fk_user_id));
  const newUserIds = userIds.filter((uid) => !existingSet.has(uid));

  if (!newUserIds.length) return;

  const client = knex.client.config.client;
  const BATCH_SIZE = 500;

  for (let i = 0; i < newUserIds.length; i += BATCH_SIZE) {
    const batch = newUserIds.slice(i, i + BATCH_SIZE);
    const placeholders = batch.map(() => '(?, ?, ?)').join(',');
    const bindings = batch.flatMap((uid) => [orgId, uid, role]);

    if (client === 'pg' || client === 'postgresql') {
      await knex.raw(
        `INSERT INTO ${MetaTable.ORG_USERS} (fk_org_id, fk_user_id, roles) VALUES ${placeholders} ON CONFLICT (fk_org_id, fk_user_id) DO NOTHING`,
        bindings,
      );
    } else if (client === 'sqlite3') {
      await knex.raw(
        `INSERT OR IGNORE INTO ${MetaTable.ORG_USERS} (fk_org_id, fk_user_id, roles) VALUES ${placeholders}`,
        bindings,
      );
    } else {
      await knex.raw(
        `INSERT IGNORE INTO ${MetaTable.ORG_USERS} (fk_org_id, fk_user_id, roles) VALUES ${placeholders}`,
        bindings,
      );
    }
  }
}

export async function up(knex: Knex) {
  // Step 1: Fix nc_org_users PK — change from fk_org_id only to composite (fk_org_id, fk_user_id)
  const hasOrgUsersTable = await knex.schema.hasTable(MetaTable.ORG_USERS);

  if (hasOrgUsersTable) {
    const client = knex.client.config.client;

    if (client === 'pg' || client === 'postgresql') {
      // Check how many columns the PK has — skip if already composite
      const pkColCount = await knex.raw(`
        SELECT COUNT(*) as cnt FROM information_schema.key_column_usage
        WHERE table_name = 'nc_org_users'
          AND constraint_name IN (
            SELECT constraint_name FROM information_schema.table_constraints
            WHERE table_name = 'nc_org_users' AND constraint_type = 'PRIMARY KEY'
          )
      `);

      if (Number(pkColCount.rows?.[0]?.cnt) < 2) {
        const pkResult = await knex.raw(`
          SELECT constraint_name FROM information_schema.table_constraints
          WHERE table_name = 'nc_org_users' AND constraint_type = 'PRIMARY KEY'
        `);

        if (pkResult.rows?.length) {
          await knex.raw(
            `ALTER TABLE ${MetaTable.ORG_USERS} DROP CONSTRAINT ${pkResult.rows[0].constraint_name}`,
          );
        }

        // Clean up orphan rows and enforce NOT NULL before adding composite PK
        await knex.raw(
          `DELETE FROM ${MetaTable.ORG_USERS} WHERE fk_user_id IS NULL`,
        );
        await knex.raw(
          `ALTER TABLE ${MetaTable.ORG_USERS} ALTER COLUMN fk_user_id SET NOT NULL`,
        );

        await knex.raw(
          `ALTER TABLE ${MetaTable.ORG_USERS} ADD PRIMARY KEY (fk_org_id, fk_user_id)`,
        );
      }
    } else if (client === 'sqlite3') {
      await knex.raw(`
        CREATE TABLE IF NOT EXISTS nc_org_users_new (
          fk_org_id VARCHAR(20) NOT NULL,
          fk_user_id VARCHAR(20) NOT NULL,
          roles VARCHAR(255),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (fk_org_id, fk_user_id)
        )
      `);
      await knex.raw(
        `INSERT OR IGNORE INTO nc_org_users_new SELECT fk_org_id, fk_user_id, roles, created_at, updated_at FROM ${MetaTable.ORG_USERS}`,
      );
      await knex.raw(`DROP TABLE ${MetaTable.ORG_USERS}`);
      await knex.raw(
        `ALTER TABLE nc_org_users_new RENAME TO ${MetaTable.ORG_USERS}`,
      );
    } else {
      // MySQL / MariaDB
      const pkColCount = await knex.raw(`
        SELECT COUNT(*) as cnt FROM information_schema.key_column_usage
        WHERE table_name = 'nc_org_users' AND constraint_name = 'PRIMARY'
      `);

      if (Number(pkColCount[0]?.[0]?.cnt) < 2) {
        await knex.raw(`ALTER TABLE ${MetaTable.ORG_USERS} DROP PRIMARY KEY`);
        await knex.raw(
          `DELETE FROM ${MetaTable.ORG_USERS} WHERE fk_user_id IS NULL`,
        );
        await knex.raw(
          `ALTER TABLE ${MetaTable.ORG_USERS} MODIFY COLUMN fk_user_id VARCHAR(20) NOT NULL`,
        );
        await knex.raw(
          `ALTER TABLE ${MetaTable.ORG_USERS} ADD PRIMARY KEY (fk_org_id, fk_user_id)`,
        );
      }
    }

    // Add index on fk_user_id for reverse lookups
    if (client === 'pg' || client === 'postgresql') {
      await knex.raw(
        `CREATE INDEX IF NOT EXISTS nc_org_users_fk_user_id_index ON ${MetaTable.ORG_USERS} (fk_user_id)`,
      );
    } else if (client === 'sqlite3') {
      const idx = await knex.raw(
        `SELECT name FROM sqlite_master WHERE type='index' AND name='nc_org_users_fk_user_id_index'`,
      );
      if (!idx?.length) {
        await knex.schema.alterTable(MetaTable.ORG_USERS, (table) => {
          table.index(['fk_user_id'], 'nc_org_users_fk_user_id_index');
        });
      }
    } else {
      const idx = await knex.raw(
        `SHOW INDEX FROM ${MetaTable.ORG_USERS} WHERE Key_name = 'nc_org_users_fk_user_id_index'`,
      );
      if (!idx?.[0]?.length) {
        await knex.schema.alterTable(MetaTable.ORG_USERS, (table) => {
          table.index(['fk_user_id'], 'nc_org_users_fk_user_id_index');
        });
      }
    }

    // Add deleted/deleted_at columns for soft-delete support
    const hasDeleted = await knex.schema.hasColumn(
      MetaTable.ORG_USERS,
      'deleted',
    );
    if (!hasDeleted) {
      await knex.schema.alterTable(MetaTable.ORG_USERS, (table) => {
        table.boolean('deleted').defaultTo(false);
        table.timestamp('deleted_at').nullable();
      });
    }
  }

  // Step 2: Create default org for on-prem / CE (idempotent)
  const existingOrg = await knex(MetaTable.ORG)
    .where('id', NC_DEFAULT_ORG_ID)
    .first();

  const superUser = !existingOrg
    ? await knex(MetaTable.USERS).where('roles', 'like', '%super%').first()
    : null;

  // Only create default org if it doesn't exist and we have a super user
  // (on cloud there's no super user — this block is skipped)
  if (!existingOrg && superUser) {
    await knex(MetaTable.ORG).insert({
      id: NC_DEFAULT_ORG_ID,
      title: 'Default Organization',
      fk_user_id: superUser.id,
      deleted: false,
    });

    await knex(MetaTable.ORG_USERS).insert({
      fk_org_id: NC_DEFAULT_ORG_ID,
      fk_user_id: superUser.id,
      roles: EnterpriseOrgUserRoles.ADMIN,
    });

    // Link all workspaces with no org to the default org
    await knex(MetaTable.WORKSPACE)
      .whereNull('fk_org_id')
      .update({ fk_org_id: NC_DEFAULT_ORG_ID });

    // Backfill all active workspace users into org (batch insert, skip duplicates)
    const workspaceUsers = await knex(MetaTable.WORKSPACE_USER)
      .distinct('fk_user_id')
      .whereNotNull('fk_user_id')
      .where(function () {
        this.where('deleted', false).orWhereNull('deleted');
      });

    const userIds = workspaceUsers
      .map((wu) => wu.fk_user_id)
      .filter((id) => id !== superUser.id);

    await batchInsertOrgUsers(
      knex,
      NC_DEFAULT_ORG_ID,
      userIds,
      EnterpriseOrgUserRoles.VIEWER,
    );

    // Store default org ID
    try {
      await knex(MetaTable.STORE).insert({
        key: NC_STORE_DEFAULT_ORG_ID_KEY,
        value: NC_DEFAULT_ORG_ID,
      });
    } catch {
      // Already exists — idempotent
    }
  }

  // Step 3: Backfill cloud orgs — add workspace users to nc_org_users
  // Runs on ALL deployments (including cloud) independently of Step 2
  const cloudOrgs = await knex(MetaTable.ORG)
    .whereNot('id', NC_DEFAULT_ORG_ID)
    .select('id');

  for (const org of cloudOrgs) {
    const orgWorkspaceUsers = await knex(MetaTable.WORKSPACE_USER)
      .distinct(`${MetaTable.WORKSPACE_USER}.fk_user_id`)
      .innerJoin(
        MetaTable.WORKSPACE,
        `${MetaTable.WORKSPACE_USER}.fk_workspace_id`,
        `${MetaTable.WORKSPACE}.id`,
      )
      .where(`${MetaTable.WORKSPACE}.fk_org_id`, org.id)
      .whereNotNull(`${MetaTable.WORKSPACE_USER}.fk_user_id`)
      .where(function () {
        this.where(`${MetaTable.WORKSPACE_USER}.deleted`, false).orWhereNull(
          `${MetaTable.WORKSPACE_USER}.deleted`,
        );
      });

    const userIds = orgWorkspaceUsers.map((wu) => wu.fk_user_id);

    await batchInsertOrgUsers(
      knex,
      org.id,
      userIds,
      EnterpriseOrgUserRoles.VIEWER,
    );
  }

  // All users default to VIEWER — workspace creation requires org admin
  // to explicitly promote users to CREATOR. This prevents guests from
  // accumulating seat counts by creating workspaces.
}

export async function down(knex: Knex) {
  // Remove backfilled org users (except admin)
  await knex(MetaTable.ORG_USERS)
    .where('fk_org_id', NC_DEFAULT_ORG_ID)
    .whereNot('roles', EnterpriseOrgUserRoles.ADMIN)
    .del();

  // Unlink workspaces
  await knex(MetaTable.WORKSPACE)
    .where('fk_org_id', NC_DEFAULT_ORG_ID)
    .update({ fk_org_id: null });

  // Remove store entry
  await knex(MetaTable.STORE).where('key', NC_STORE_DEFAULT_ORG_ID_KEY).del();

  // Remove default org
  await knex(MetaTable.ORG).where('id', NC_DEFAULT_ORG_ID).del();
}
