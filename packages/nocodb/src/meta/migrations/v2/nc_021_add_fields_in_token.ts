import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.API_TOKENS, (table) => {
    table.string('fk_user_id', 20);
    table.foreign('fk_user_id').references(`${MetaTable.USERS}.id`);
  });

  await knex.schema.alterTable(MetaTable.SYNC_SOURCE, (table) => {
    table.dropForeign(['fk_user_id']);
  });
};

const down = async (knex) => {
  await knex.schema.alterTable(MetaTable.API_TOKENS, (table) => {
    table.dropForeign(['fk_user_id']);
    table.dropColumn('fk_user_id');
  });

  await knex.schema.alterTable(MetaTable.SYNC_SOURCE, (table) => {
    table.foreign('fk_user_id').references(`${MetaTable.USERS}.id`);
  });
};

export { up, down };
