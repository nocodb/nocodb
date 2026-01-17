import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  // Add SCIM-related columns to workspace_user table (not users table)
  // Since SCIM is workspace-specific and users are shared across workspaces
  await knex.schema.alterTable(MetaTable.WORKSPACE_USER, (table) => {
    // External ID from SCIM provider (IdP)
    table.string('scim_external_id', 255).nullable();

    // Flag indicating if user is managed via SCIM in this workspace
    table.boolean('scim_managed').defaultTo(false);

    // Username from SCIM (may differ from email)
    table.string('scim_user_name', 255).nullable();

    // Additional SCIM metadata (department, title, manager, etc.)
    table.text('scim_meta').nullable();
  });

  // Add SCIM-related columns to nc_teams table
  await knex.schema.alterTable(MetaTable.TEAMS, (table) => {
    // External ID from SCIM provider (IdP Group ID)
    table.string('scim_external_id', 255).nullable().unique();

    // Flag indicating if team is managed via SCIM
    table.boolean('scim_managed').defaultTo(false);

    // Display name from SCIM
    table.string('scim_display_name', 255).nullable();
  });

  // Create nc_scim_config table for workspace-level SCIM configuration
  await knex.schema.createTable(MetaTable.SCIM_CONFIG, (table) => {
    table.string('id', 20).primary().notNullable();
    table.string('fk_workspace_id', 20).notNullable().unique();
    table.boolean('enabled').defaultTo(false);

    // Encrypted provisioning token for IdP authentication
    table.text('provisioning_token').notNullable();

    // SCIM base URL for this workspace
    table.text('base_url').notNullable();

    // Role mapping configuration (JSON)
    table.text('role_mapping').nullable();

    table.timestamps(true, true);

    // Index for workspace lookup
    table.index('fk_workspace_id', 'nc_scim_config_workspace_idx');
  });

  // Add indexes for SCIM external ID lookups (for fast SCIM queries)
  await knex.schema.alterTable(MetaTable.WORKSPACE_USER, (table) => {
    table.index('scim_external_id', 'nc_workspace_user_scim_external_id_idx');
    table.index('scim_managed', 'nc_workspace_user_scim_managed_idx');
  });

  await knex.schema.alterTable(MetaTable.TEAMS, (table) => {
    table.index('scim_external_id', 'nc_teams_scim_external_id_idx');
    table.index('scim_managed', 'nc_teams_scim_managed_idx');
  });
};

const down = async (knex: Knex) => {
  // Drop SCIM config table
  await knex.schema.dropTableIfExists(MetaTable.SCIM_CONFIG);

  // Remove SCIM columns from nc_teams
  await knex.schema.alterTable(MetaTable.TEAMS, (table) => {
    table.dropIndex('scim_external_id', 'nc_teams_scim_external_id_idx');
    table.dropIndex('scim_managed', 'nc_teams_scim_managed_idx');
    table.dropColumn('scim_external_id');
    table.dropColumn('scim_managed');
    table.dropColumn('scim_display_name');
  });

  // Remove SCIM columns from workspace_user
  await knex.schema.alterTable(MetaTable.WORKSPACE_USER, (table) => {
    table.dropIndex(
      'scim_external_id',
      'nc_workspace_user_scim_external_id_idx',
    );
    table.dropIndex('scim_managed', 'nc_workspace_user_scim_managed_idx');
    table.dropColumn('scim_external_id');
    table.dropColumn('scim_managed');
    table.dropColumn('scim_user_name');
    table.dropColumn('scim_meta');
  });
};

export { up, down };
