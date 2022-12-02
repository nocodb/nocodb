import { Knex } from 'knex';
import { MetaTableOld } from '../../utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTableOld.USERS, (table) => {
    table.string('token_version');
  });
};

const down = async (knex) => {
  await knex.schema.alterTable(MetaTableOld.USERS, (table) => {
    table.dropColumns('token_version');
  });
};

export { up, down };
