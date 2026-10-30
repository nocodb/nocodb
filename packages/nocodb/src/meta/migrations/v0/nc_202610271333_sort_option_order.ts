import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

// Opt-in per-sort ordering: `option_order` sorts a SingleSelect by its option
// position. NULL keeps the default (alphabetical).
const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.SORT, (table) => {
    table.string('order_by', 20);
  });
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.SORT, (table) => {
    table.dropColumn('order_by');
  });
};

export { up, down };
