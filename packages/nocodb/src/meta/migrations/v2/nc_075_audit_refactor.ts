import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.AUDIT, (table) => {
    table.smallint('version').unsigned().defaultTo(0);
    table.string('fk_user_id', 20);
    // this is a foreign key to keep any reference id, like view id, webhook id, etc
    table.string('fk_ref_id', 20);
    table.string('fk_parent_id', 20);
    table.text('user_agent');
  });
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.AUDIT, (table) => {
    table.dropColumn('version');
    table.dropColumn('fk_user_id');
    table.dropColumn('fk_ref_id');
    table.dropColumn('fk_parent_id');
    table.dropColumn('user_agent');
  });
};

export { up, down };
