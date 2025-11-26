import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.DEPENDENCY_TRACKER, (table) => {
    table.text('slot_0');
    table.text('slot_1');
    table.text('slot_2');
    table.text('slot_3');
    table.text('slot_4');
  });
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.DEPENDENCY_TRACKER, (table) => {
    table.dropColumn('slot_0');
    table.dropColumn('slot_1');
    table.dropColumn('slot_2');
    table.dropColumn('slot_3');
    table.dropColumn('slot_4');
  });
};

export { up, down };
