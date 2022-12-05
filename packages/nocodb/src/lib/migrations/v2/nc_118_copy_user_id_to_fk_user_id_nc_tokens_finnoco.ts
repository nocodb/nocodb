import { Knex } from 'knex';
import { MetaTable } from '../../utils/globals';

const up = async (knex: Knex) => {
  await knex(MetaTable.API_TOKENS).update({
    fk_user_id: knex.ref('user_id'),
  });

  await knex.schema.alterTable(MetaTable.API_TOKENS, (table) => {
    table.dropColumn('user_id');
  });
};

const down = async (knex) => {
  await knex.schema.alterTable(MetaTable.API_TOKENS, (table) => {
    table.string('user_id');
  });

  await knex(MetaTable.API_TOKENS).update({
    user_id: knex.ref('fk_user_id'),
  });
};

export { up, down };
