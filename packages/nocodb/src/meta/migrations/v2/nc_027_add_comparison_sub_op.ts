import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.FILTER_EXP, (table) => {
    table.string('comparison_sub_op');
  });
};

const down = async (knex) => {
  await knex.schema.alterTable(MetaTable.FILTER_EXP, (table) => {
    table.dropColumns('comparison_sub_op');
  });
};

export { up, down };
