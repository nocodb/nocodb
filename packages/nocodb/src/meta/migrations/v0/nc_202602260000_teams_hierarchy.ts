import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
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
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.TEAMS, (table) => {
    table.dropIndex([], 'nc_teams_parent_idx');
    table.dropColumn('fk_parent_team_id');
    table.dropColumn('depth');
    table.dropColumn('path');
  });
};

export { up, down };
