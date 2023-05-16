import { MetaTable } from '../../utils/globals';
import type { Knex } from 'knex';

const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.USERS, (table) => {
    table.text('otpSecret');
  });
};

const down = async (knex) => {
  await knex.schema.alterTable(MetaTable.USERS, (table) => {
    table.dropColumn('otpSecret');
  });
};

export { up, down };
