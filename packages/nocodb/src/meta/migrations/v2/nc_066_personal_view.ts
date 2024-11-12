import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.VIEWS, (table) => {
    table.boolean('is_personal').defaultTo(false);
    table.boolean('created_by', 20).index();
  });
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.SOURCES, (table) => {
    table.dropColumn('is_personal');
    table.dropColumn('created_by');
  });
};

export { up, down };
