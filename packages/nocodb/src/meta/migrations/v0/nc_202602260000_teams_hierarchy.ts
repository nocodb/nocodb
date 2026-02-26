import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  // Add hierarchy columns to teams table
  await knex.schema.alterTable(MetaTable.TEAMS, (table) => {
    table.string('fk_parent_team_id', 20).nullable().defaultTo(null);
    table.integer('depth').defaultTo(0);
    table.text('path').nullable();
    table.index('fk_parent_team_id', 'nc_teams_parent_idx');
  });

  // Backfill existing teams as root teams
  const teams = await knex(MetaTable.TEAMS).select('id');
  for (const team of teams) {
    await knex(MetaTable.TEAMS)
      .where('id', team.id)
      .update({ path: `/${team.id}`, depth: 0 });
  }

  // Add hierarchy_scope to permission subjects for team descendant expansion
  await knex.schema.alterTable(MetaTable.PERMISSION_SUBJECTS, (table) => {
    table.string('hierarchy_scope', 30).nullable().defaultTo(null);
  });

  // Add hierarchy_scope to RLS policy subjects for team descendant expansion
  await knex.schema.alterTable(MetaTable.RLS_POLICY_SUBJECTS, (table) => {
    table.string('hierarchy_scope', 30).nullable().defaultTo(null);
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
