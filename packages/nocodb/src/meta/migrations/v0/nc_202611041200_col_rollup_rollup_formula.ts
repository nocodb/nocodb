import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const COLUMNS = ['rollup_formula', 'parsed_tree'];

// guarded: the columns may already exist where they were mirrored by hand
// (prod meta replica) ahead of the deploy
const up = async (knex: Knex) => {
  for (const column of COLUMNS) {
    if (await knex.schema.hasColumn(MetaTable.COL_ROLLUP, column)) continue;
    await knex.schema.alterTable(MetaTable.COL_ROLLUP, (table) => {
      table.text(column);
    });
  }
};

const down = async (knex: Knex) => {
  for (const column of COLUMNS) {
    if (!(await knex.schema.hasColumn(MetaTable.COL_ROLLUP, column))) continue;
    await knex.schema.alterTable(MetaTable.COL_ROLLUP, (table) => {
      table.dropColumn(column);
    });
  }
};

export { up, down };
