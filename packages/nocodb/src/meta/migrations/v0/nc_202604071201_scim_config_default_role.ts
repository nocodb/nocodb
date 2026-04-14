import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  const migrationStart = Date.now();
  console.log(
    '[nc_202604071201_scim_config_default_role] Starting migration...',
  );

  // 1. Add default_role to SCIM config
  const step1Start = Date.now();
  console.log(
    '[nc_202604071201_scim_config_default_role] Step 1: Add default_role column...',
  );
  await knex.schema.alterTable(MetaTable.SCIM_CONFIG, (table) => {
    table.string('default_role', 50).nullable().defaultTo('no-access');
  });
  console.log(
    `[nc_202604071201_scim_config_default_role] Step 1 completed in ${
      Date.now() - step1Start
    }ms`,
  );

  // 2. Migrate nc_scim_config from workspace-scoped to org-scoped:
  const step2Start = Date.now();
  console.log(
    '[nc_202604071201_scim_config_default_role] Step 2: Migrate SCIM config to org-scoped...',
  );
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

  console.log(
    `[nc_202604071201_scim_config_default_role] Step 2 completed in ${
      Date.now() - step2Start
    }ms`,
  );

  // 3. Add SCIM columns to nc_org_users (org-level provisioning)
  const step3Start = Date.now();
  console.log(
    '[nc_202604071201_scim_config_default_role] Step 3: Add SCIM columns to org_users...',
  );
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
      table.index('scim_external_id', 'nc_org_users_scim_external_id_idx');
      table.index('scim_managed', 'nc_org_users_scim_managed_idx');
    });
  }

  console.log(
    `[nc_202604071201_scim_config_default_role] Step 3 completed in ${
      Date.now() - step3Start
    }ms`,
  );

  console.log(
    `[nc_202604071201_scim_config_default_role] Migration completed in ${
      Date.now() - migrationStart
    }ms`,
  );
};

const down = async (knex: Knex) => {
  // Remove SCIM columns from org_users
  const hasScimCol = await knex.schema.hasColumn(
    MetaTable.ORG_USERS,
    'scim_external_id',
  );
  if (hasScimCol) {
    await knex.schema.alterTable(MetaTable.ORG_USERS, (table) => {
      table.dropIndex('scim_external_id', 'nc_org_users_scim_external_id_idx');
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

  // Drop default_role
  await knex.schema.alterTable(MetaTable.SCIM_CONFIG, (table) => {
    table.dropColumn('default_role');
  });
};

export { up, down };
