import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.INSTALLATIONS, (table) => {
    table.string('fk_user_id', 20);
    table.index(['fk_user_id'], 'nc_installations_fk_user_id_idx');
  });

  await knex.schema.alterTable(MetaTable.USERS, (table) => {
    table.string('stripe_customer_id', 255);
  });

  await knex.schema.alterTable(MetaTable.INSTALLATIONS, (table) => {
    table.integer('min_seats').notNullable().defaultTo(1);
  });
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.INSTALLATIONS, (table) => {
    table.dropColumn('min_seats');
  });

  await knex.schema.alterTable(MetaTable.INSTALLATIONS, (table) => {
    table.dropIndex(['fk_user_id'], 'nc_installations_fk_user_id_idx');
    table.dropColumn('fk_user_id');
  });

  await knex.schema.alterTable(MetaTable.USERS, (table) => {
    table.dropColumn('stripe_customer_id');
  });
};

export { up, down };
