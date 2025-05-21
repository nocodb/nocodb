import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.USERS, (table) => {
    table.boolean('blocked').defaultTo(false);
    table.string('blocked_reason');
  });
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.USERS, (table) => {
    table.dropColumn('blocked');
    table.dropColumn('blocked_reason');
  });
};

export { up, down };
