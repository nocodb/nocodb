import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  // Create nc_teams table
  await knex.schema.createTable(MetaTable.TEAMS, (table) => {
    table.string('id', 20).primary().notNullable();
    table.string('title', 255).notNullable();
    table.text('meta'); // JSON field for icon, badge_color, etc.
    table.string('fk_org_id', 20);
    table.string('fk_workspace_id', 20);
    table.string('fk_created_by', 20).index('nc_teams_created_by_idx');
    table.timestamps(true, true);

    // Indexes for fast lookups
    table.index('fk_org_id', 'nc_teams_org_idx');
    table.index('fk_workspace_id', 'nc_teams_workspace_idx');
  });

  // Note: Team membership is handled through nc_principal_assignments table
  // No separate nc_team_users or nc_principals table needed

  // Create nc_principal_assignments table (simplified polymorphic resource assignments)
  await knex.schema.createTable(MetaTable.PRINCIPAL_ASSIGNMENTS, (table) => {
    table.string('resource_type', 20).notNullable(); // 'org', 'workspace', 'base', 'team', etc.
    table.string('resource_id', 20).notNullable(); // ID of the resource
    table.string('principal_type', 20).notNullable(); // 'user', 'team', 'workspace', etc.
    table.string('principal_ref_id', 20).notNullable(); // FK to user/team/workspace table
    table.string('roles', 255).notNullable(); // Role(s) assigned
    table.timestamps(true, true);

    // Primary key on composite columns
    table.primary(
      ['resource_type', 'resource_id', 'principal_type', 'principal_ref_id'],
      'nc_principal_assignments_pk',
    );

    // Indexes for fast lookups
    table.index(
      ['principal_type', 'principal_ref_id'],
      'nc_principal_assignments_principal_idx',
    );
    table.index(
      ['resource_type', 'resource_id'],
      'nc_principal_assignments_resource_idx',
    );
    table.index(
      ['principal_type', 'principal_ref_id', 'resource_type'],
      'nc_principal_assignments_principal_resource_idx',
    );
  });
};

const down = async (knex: Knex) => {
  // Drop tables in reverse order
  await knex.schema.dropTable(MetaTable.PRINCIPAL_ASSIGNMENTS);
  await knex.schema.dropTable(MetaTable.TEAMS);
};

export { up, down };
