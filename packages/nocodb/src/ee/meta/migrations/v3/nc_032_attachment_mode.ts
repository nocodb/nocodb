import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.VIEWS, (table) => {
    table.string('attachment_mode_column_id', 20);
    table.string('expanded_record_mode');
  });
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.VIEWS, (table) => {
    table.dropColumn('attachment_mode_column_id');
    table.dropColumn('expanded_record_mode');
  });
};

export { up, down };
