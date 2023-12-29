import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.MODEL_STAT, (table) => {
    table.boolean('is_external').defaultTo(false);
  });
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.MODEL_STAT, (table) => {
    table.dropColumn('is_external');
  });
};

export { up, down };
