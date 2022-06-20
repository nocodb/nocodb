import Knex from 'knex';
import { MetaTable } from '../../utils/globals';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable(MetaTable.COLUMNS, table => {
    table.boolean('public').defaultTo(false);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable(MetaTable.COLUMNS, table => {
    table.dropColumn('pulic');
  });
}
