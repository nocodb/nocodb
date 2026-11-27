import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

// Field a record comment is about; null = the whole record.
const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.COMMENTS, (table) => {
    table.string('fk_column_id', 20);
  });
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.COMMENTS, (table) => {
    table.dropColumn('fk_column_id');
  });
};

export { up, down };
