import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.COL_ROLLUP, (table) => {
    table.text('rollup_formula');
    table.text('parsed_tree');
  });
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.COL_ROLLUP, (table) => {
    table.dropColumn('rollup_formula');
    table.dropColumn('parsed_tree');
  });
};

export { up, down };
