import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.COL_BUTTON, (table) => {
    table.primary(['id']);
  });
};

const down = async (knex) => {
  await knex.schema.alterTable(MetaTable.COL_BUTTON, (table) => {
    table.dropPrimary(['id']);
  });
};

export { up, down };
