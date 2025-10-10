import { down as cleanDown, up as cleanUp } from './nc_032_cleanup';
import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await cleanUp(knex);

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

  // Create nc_team_users table
  await knex.schema.createTable(MetaTable.TEAM_USERS, (table) => {
    table.string('fk_team_id', 20).notNullable();
    table.string('fk_user_id', 20).notNullable();
    table.string('roles', 255).notNullable().defaultTo('member'); // owner, manager, member, viewer
    table.timestamps(true, true);

    // Primary key on composite columns
    table.primary(['fk_team_id', 'fk_user_id'], 'nc_team_users_pk');

    // Indexes for fast lookups
    table.index('fk_team_id', 'nc_team_users_team_idx');
    table.index('fk_user_id', 'nc_team_users_user_idx');
  });

  // Create nc_principals table (polymorphic access control)
  await knex.schema.createTable(MetaTable.PRINCIPALS, (table) => {
    table.string('id', 20).primary().notNullable();
    table.string('principal_type', 20).notNullable(); // 'user', 'team', 'bot', etc.
    table.string('ref_id', 20).notNullable(); // FK to user/team/bot table
    table.timestamps(true, true);

    // Index for fast lookup by type and reference
    table.index(['principal_type', 'ref_id'], 'nc_principals_type_ref_idx');
  });

  // Create nc_principal_assignments table (polymorphic resource assignments)
  await knex.schema.createTable(MetaTable.PRINCIPAL_ASSIGNMENTS, (table) => {
    table.string('resource_type', 20).notNullable(); // 'org', 'workspace', 'base', etc.
    table.string('resource_id', 20).notNullable(); // ID of the resource
    table.string('fk_principal_id', 20).notNullable();
    table.string('roles', 255).notNullable(); // Role(s) assigned
    table.timestamps(true, true);

    // Primary key on composite columns
    table.primary(
      ['resource_type', 'resource_id', 'fk_principal_id'],
      'nc_principal_assignments_pk',
    );

    // Indexes for fast lookups
    table.index('fk_principal_id', 'nc_principal_assignments_principal_idx');
    table.index(
      ['resource_type', 'resource_id'],
      'nc_principal_assignments_resource_idx',
    );
  });
};

const down = async (knex: Knex) => {
  // Drop tables in reverse order
  await knex.schema.dropTable(MetaTable.PRINCIPAL_ASSIGNMENTS);
  await knex.schema.dropTable(MetaTable.PRINCIPALS);
  await knex.schema.dropTable(MetaTable.TEAM_USERS);
  await knex.schema.dropTable(MetaTable.TEAMS);

  await cleanDown(knex);
};

export { up, down };
