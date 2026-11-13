import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.SUBSCRIPTIONS, (table) => {
    table.timestamp('price_switch_at');
    table.string('price_switch_to', 20);
  });
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.SUBSCRIPTIONS, (table) => {
    table.dropColumn('price_switch_at');
    table.dropColumn('price_switch_to');
  });
};

export { up, down };
