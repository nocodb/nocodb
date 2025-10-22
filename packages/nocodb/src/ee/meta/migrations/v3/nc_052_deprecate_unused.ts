import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.dropTableIfExists(MetaTable.COWRITER);
  await knex.schema.dropTableIfExists(MetaTable.BOOK);
};

const down = async (knex: Knex) => {
  await knex.schema.createTable(MetaTable.COWRITER, (table) => {
    table.string('id', 20).notNullable().primary();
    table.string('fk_model_id', 20);
    table.text('prompt_statement');
    table.text('prompt_statement_template');
    table.text('output');
    table.text('meta');
    table.boolean('is_read').defaultTo(false);
    table.string('created_by', 20);
    table.timestamps(true, true);
  });

  await knex.schema.createTable(MetaTable.BOOK, (table) => {
    table.string('id', 20).notNullable().primary();
    table.string('title', 150).notNullable();
    table.text('description').defaultTo('');
    table.string('slug', 150).notNullable();
    table.string('project_id', 20).notNullable();
    table.string('created_by_id', 20).notNullable();
    table.string('last_updated_by_id', 20);
    table.boolean('is_published').defaultTo(false);
    table.timestamp('last_published_date', { useTz: true });
    table.string('last_published_by_id', 20);
    table.string('pages_table_name', 100);
    table.text('metaJson').defaultTo('{}');
    table.float('order');
    table.timestamps(true, true);
  });
};

export { up, down };
