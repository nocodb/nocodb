import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.API_TOKENS, (table) => {
    table.string('fk_sso_client_id', 20);
    table.index('fk_sso_client_id');
  });
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.API_TOKENS, (table) => {
    table.dropIndex('fk_sso_client_id');
    table.dropColumn('fk_sso_client_id');
  });
};

export { up, down };
