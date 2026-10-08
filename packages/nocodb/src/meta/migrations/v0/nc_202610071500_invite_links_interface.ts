import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

/** Interface-scoped invite links: `base_id` stays the interface's base. */
const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.INVITE_LINKS, (table) => {
    table.string('fk_interface_id', 20);
    table.index(['fk_interface_id'], 'nc_invite_links_interface_idx');
  });
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.INVITE_LINKS, (table) => {
    table.dropIndex(['fk_interface_id'], 'nc_invite_links_interface_idx');
    table.dropColumn('fk_interface_id');
  });
};

export { up, down };
