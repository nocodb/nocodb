import { Knex } from 'knex';
import { MetaTableOld as MetaTable } from '../../utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.VIEWS, (table) => {
    table.text('meta');
  });
};

const down = async (knex) => {
  await knex.schema.alterTable(MetaTable.VIEWS, (table) => {
    table.dropColumns('meta');
  });
};

export { up, down };
