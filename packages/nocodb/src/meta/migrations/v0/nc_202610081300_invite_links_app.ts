import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

/** App-scoped invite links: `base_id` stays the app's base. */
const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.INVITE_LINKS, (table) => {
    table.string('fk_app_id', 20);
    table.string('fk_app_team_id', 20);
    table.index(['fk_app_id'], 'nc_invite_links_app_idx');
  });
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.INVITE_LINKS, (table) => {
    table.dropIndex(['fk_app_id'], 'nc_invite_links_app_idx');
    table.dropColumn('fk_app_team_id');
    table.dropColumn('fk_app_id');
  });
};

export { up, down };
