import { Knex } from 'knex';
import { MetaTable } from '../../utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.VIEWS, (table) => {
    table.string('section', 128);
  });
};

const down = async (knex) => {
  await knex.schema.alterTable(MetaTable.VIEWS, (table) => {
    table.dropColumn('section');
  });
};

export { up, down };
