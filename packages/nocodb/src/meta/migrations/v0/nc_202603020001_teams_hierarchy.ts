import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  // Add hierarchy columns to teams table
  await knex.schema.alterTable(MetaTable.TEAMS, (table) => {
    table.string('fk_parent_team_id', 20);
    table.integer('depth').defaultTo(0);
    table.text('path');
    table.index('fk_parent_team_id', 'nc_teams_parent_idx');
  });

  // Backfill existing teams as root teams
  const client = (knex.client.config.client as string) ?? '';
  // MySQL uses CONCAT; PostgreSQL and SQLite both support || for concatenation
  const pathExpr = ['mysql', 'mysql2'].includes(client)
    ? knex.raw("CONCAT('/', id)")
    : knex.raw("'/' || id");
  await knex(MetaTable.TEAMS).update({ path: pathExpr, depth: 0 });

  // Add hierarchy_scope to permission subjects for team descendant expansion
  await knex.schema.alterTable(MetaTable.PERMISSION_SUBJECTS, (table) => {
    table.string('hierarchy_scope', 30);
  });

  // Add hierarchy_scope to RLS policy subjects for team descendant expansion
  await knex.schema.alterTable(MetaTable.RLS_POLICY_SUBJECTS, (table) => {
    table.string('hierarchy_scope', 30);
  });
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.RLS_POLICY_SUBJECTS, (table) => {
    table.dropColumn('hierarchy_scope');
  });

  await knex.schema.alterTable(MetaTable.PERMISSION_SUBJECTS, (table) => {
    table.dropColumn('hierarchy_scope');
  });

  await knex.schema.alterTable(MetaTable.TEAMS, (table) => {
    table.dropIndex([], 'nc_teams_parent_idx');
    table.dropColumn('fk_parent_team_id');
    table.dropColumn('depth');
    table.dropColumn('path');
  });
};

export { up, down };
