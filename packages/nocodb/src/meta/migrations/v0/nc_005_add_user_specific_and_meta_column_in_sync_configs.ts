import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.SYNC_CONFIGS, (table) => {
    table.string('created_by', 20);
    table.string('updated_by', 20);
    table.text('meta'); // JSON field
  });
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.SYNC_CONFIGS, (table) => {
    table.dropColumn('created_by');
    table.dropColumn('updated_by');
    table.dropColumn('meta');
  });
};

export { up, down };
