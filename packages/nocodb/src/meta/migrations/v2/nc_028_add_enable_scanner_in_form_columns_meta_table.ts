import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.FORM_VIEW_COLUMNS, (table) => {
    table.boolean('enable_scanner');
  });
};

const down = async (knex) => {
  await knex.schema.alterTable(MetaTable.FORM_VIEW_COLUMNS, (table) => {
    table.dropColumns('enable_scanner');
  });
};

export { up, down };
