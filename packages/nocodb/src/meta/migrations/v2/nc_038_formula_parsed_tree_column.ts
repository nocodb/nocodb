import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.COL_FORMULA, (table) => {
    table.text('parsed_tree');
  });
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.COL_FORMULA, (table) => {
    table.dropColumn('parsed_tree');
  });
};

export { up, down };
