import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  // 1. Add default_role to SCIM config
  await knex.schema.alterTable(MetaTable.SCIM_CONFIG, (table) => {
    table.string('default_role', 50).nullable().defaultTo('no-access');
  });

  // 2. Migrate nc_scim_config from workspace-scoped to org-scoped:
  //    add fk_org_id, drop fk_workspace_id unique + index, then drop column
  const hasOrgId = await knex.schema.hasColumn(
    MetaTable.SCIM_CONFIG,
    'fk_org_id',
  );
  if (!hasOrgId) {
    await knex.schema.alterTable(MetaTable.SCIM_CONFIG, (table) => {
      table.string('fk_org_id', 20).nullable();
      table.index('fk_org_id', 'nc_scim_config_org_idx');
    });
  }

  const hasWsId = await knex.schema.hasColumn(
    MetaTable.SCIM_CONFIG,
    'fk_workspace_id',
  );
  if (hasWsId) {
    await knex.schema.alterTable(MetaTable.SCIM_CONFIG, (table) => {
      table.dropIndex('fk_workspace_id', 'nc_scim_config_workspace_idx');
      table.dropUnique(['fk_workspace_id']);
      table.dropColumn('fk_workspace_id');
    });
  }

  // 3. Add SCIM columns to nc_org_users (org-level provisioning)
  const hasScimCol = await knex.schema.hasColumn(
    MetaTable.ORG_USERS,
    'scim_external_id',
  );
  if (!hasScimCol) {
    await knex.schema.alterTable(MetaTable.ORG_USERS, (table) => {
      table.string('scim_external_id', 255).nullable();
      table.boolean('scim_managed').defaultTo(false);
      table.string('scim_user_name', 255).nullable();
      table.text('scim_meta').nullable();
    });

    await knex.schema.alterTable(MetaTable.ORG_USERS, (table) => {
      table.unique(
        ['fk_org_id', 'scim_external_id'],
        'nc_org_users_org_scim_ext_id_unique',
      );
      table.index('scim_managed', 'nc_org_users_scim_managed_idx');
    });
  }

  // Fix nc_teams: replace global unique on scim_external_id with composite per-org unique
  const hasTeamsScimCol = await knex.schema.hasColumn(
    MetaTable.TEAMS,
    'scim_external_id',
  );
  if (hasTeamsScimCol) {
    const client = knex.client.config.client;

    // Drop global unique on scim_external_id (created in nc_021_scim_support)
    // Check existence first to avoid aborting PG transaction
    if (client === 'pg' || client === 'postgresql') {
      const existing = await knex.raw(`
        SELECT 1 FROM pg_indexes
        WHERE tablename = 'nc_teams'
          AND indexname IN ('nc_teams_scim_external_id_unique', 'nc_teams_scim_external_id_idx')
        LIMIT 1
      `);
      if (existing.rows?.length) {
        await knex.raw(
          `DROP INDEX IF EXISTS nc_teams_scim_external_id_unique`,
        );
        await knex.raw(
          `DROP INDEX IF EXISTS nc_teams_scim_external_id_idx`,
        );
      }

      // Add composite unique per org (partial — allows NULLs for non-SCIM teams)
      await knex.raw(
        `CREATE UNIQUE INDEX IF NOT EXISTS nc_teams_org_scim_ext_id_unique ON ${MetaTable.TEAMS} (fk_org_id, scim_external_id) WHERE scim_external_id IS NOT NULL`,
      );
    } else if (client === 'sqlite3') {
      // SQLite: drop old index if exists, create new
      await knex.raw(
        `DROP INDEX IF EXISTS nc_teams_scim_external_id_unique`,
      );
      await knex.schema.alterTable(MetaTable.TEAMS, (table) => {
        table.unique(
          ['fk_org_id', 'scim_external_id'],
          'nc_teams_org_scim_ext_id_unique',
        );
      });
    } else {
      // MySQL: check and drop
      const idx = await knex.raw(
        `SHOW INDEX FROM ${MetaTable.TEAMS} WHERE Key_name = 'nc_teams_scim_external_id_unique'`,
      );
      if (idx?.[0]?.length) {
        await knex.schema.alterTable(MetaTable.TEAMS, (table) => {
          table.dropUnique(['scim_external_id']);
        });
      }
      await knex.schema.alterTable(MetaTable.TEAMS, (table) => {
        table.unique(
          ['fk_org_id', 'scim_external_id'],
          'nc_teams_org_scim_ext_id_unique',
        );
      });
    }
  }
};

const down = async (knex: Knex) => {
  // Remove SCIM columns from org_users
  const hasScimCol = await knex.schema.hasColumn(
    MetaTable.ORG_USERS,
    'scim_external_id',
  );
  if (hasScimCol) {
    await knex.schema.alterTable(MetaTable.ORG_USERS, (table) => {
      table.dropUnique(
        ['fk_org_id', 'scim_external_id'],
        'nc_org_users_org_scim_ext_id_unique',
      );
      table.dropIndex('scim_managed', 'nc_org_users_scim_managed_idx');
      table.dropColumn('scim_external_id');
      table.dropColumn('scim_managed');
      table.dropColumn('scim_user_name');
      table.dropColumn('scim_meta');
    });
  }

  // Restore fk_workspace_id on scim_config
  const hasOrgId = await knex.schema.hasColumn(
    MetaTable.SCIM_CONFIG,
    'fk_org_id',
  );
  if (hasOrgId) {
    await knex.schema.alterTable(MetaTable.SCIM_CONFIG, (table) => {
      table.dropIndex('fk_org_id', 'nc_scim_config_org_idx');
      table.dropColumn('fk_org_id');
    });

    await knex.schema.alterTable(MetaTable.SCIM_CONFIG, (table) => {
      table.string('fk_workspace_id', 20).notNullable().unique();
      table.index('fk_workspace_id', 'nc_scim_config_workspace_idx');
    });
  }

  // Restore global unique on nc_teams scim_external_id
  const client = knex.client.config.client;
  if (client === 'pg' || client === 'postgresql') {
    await knex.raw(`DROP INDEX IF EXISTS nc_teams_org_scim_ext_id_unique`);
    await knex.raw(
      `CREATE UNIQUE INDEX IF NOT EXISTS nc_teams_scim_external_id_unique ON ${MetaTable.TEAMS} (scim_external_id) WHERE scim_external_id IS NOT NULL`,
    );
  } else if (client === 'sqlite3') {
    await knex.raw(`DROP INDEX IF EXISTS nc_teams_org_scim_ext_id_unique`);
    await knex.schema.alterTable(MetaTable.TEAMS, (table) => {
      table.unique(['scim_external_id']);
    });
  } else {
    const idx = await knex.raw(
      `SHOW INDEX FROM ${MetaTable.TEAMS} WHERE Key_name = 'nc_teams_org_scim_ext_id_unique'`,
    );
    if (idx?.[0]?.length) {
      await knex.schema.alterTable(MetaTable.TEAMS, (table) => {
        table.dropUnique(
          ['fk_org_id', 'scim_external_id'],
          'nc_teams_org_scim_ext_id_unique',
        );
        table.unique(['scim_external_id']);
      });
    }
  }

  // Drop default_role
  await knex.schema.alterTable(MetaTable.SCIM_CONFIG, (table) => {
    table.dropColumn('default_role');
  });
};

export { up, down };
