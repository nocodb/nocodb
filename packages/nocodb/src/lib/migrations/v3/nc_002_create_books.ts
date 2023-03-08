import { MetaTable } from '../../utils/globals';
import type { Knex } from 'knex';

const up = async (knex: Knex) => {
  await knex.schema.createTable(MetaTable.BOOK, (table) => {
    table.string('id', 20).primary().notNullable();

    table.string('title', 150).notNullable();
    table.text('description', 'longtext').defaultTo('');
    table.string('slug', 150).notNullable();

    table.string('project_id', 20).notNullable();
    table.foreign('project_id').references(`${MetaTable.PROJECT}.id`);

    table.string('created_by_id', 20).notNullable();
    table.foreign('created_by_id').references(`${MetaTable.USERS}.id`);

    table.string('last_updated_by_id', 20).nullable();
    table.foreign('last_updated_by_id').references(`${MetaTable.USERS}.id`);

    table.boolean('is_published').defaultTo(false);
    table.datetime('last_published_date').nullable();
    table.string('last_published_by_id', 20).nullable();
    table.foreign('last_published_by_id').references(`${MetaTable.USERS}.id`);

    table.string('pages_table_name', 100);

    table.text('metaJson', 'longtext').defaultTo('{}');
    table.float('order');

    table.timestamps(true, true);
  });
};

const down = async (knex: Knex) => {
  await knex.schema.dropTable(MetaTable.BOOK);
};

export { up, down };
