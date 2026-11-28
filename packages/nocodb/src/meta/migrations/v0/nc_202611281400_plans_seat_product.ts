import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.PLANS, (table) => {
    table.string('stripe_seat_product_id', 255);
  });
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.PLANS, (table) => {
    table.dropColumn('stripe_seat_product_id');
  });
};

export { up, down };
