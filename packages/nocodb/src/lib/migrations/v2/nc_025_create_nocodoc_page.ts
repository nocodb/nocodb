import { MetaTable } from '../../utils/globals';
import { Knex } from 'knex';

const up = async (knex: Knex) => {
  await knex.schema.createTable(MetaTable.DOCS_PAGE, (table) => {
    table.string('id', 20).primary().notNullable();

    table.string('project_id', 20).notNullable();
    table.foreign('project_id').references(`${MetaTable.PROJECT}.id`);

    table.string('title', 150).notNullable();
    table.text('description', 'longtext').defaultTo('');
    
    table.text('content', 'longtext').defaultTo('');
    table.text('published_content', 'longtext').defaultTo('');
    // todo: Handle the case when there is a slug duplicate
    table.string('slug', 150).notNullable().unique();

    table.boolean('is_parent').defaultTo(false);
    table.string('parent_page_id', 20).nullable();
    table.foreign('parent_page_id').references(`${MetaTable.DOCS_PAGE}.id`);

    table.boolean('is_published').defaultTo(false);
    table.datetime('last_published_date').nullable();
    table.string('last_published_by_id', 20).nullable();
    table.foreign('last_published_by_id').references(`${MetaTable.USERS}.id`);

    table.string('last_updated_by_id', 20).nullable();
    table.foreign('last_updated_by_id').references(`${MetaTable.USERS}.id`);

    table.string('created_by_id', 20).notNullable();
    table.foreign('created_by_id').references(`${MetaTable.USERS}.id`);

    table.timestamp('archived_date').nullable();
    table.string('archived_by_id', 20).nullable();
    table.foreign('archived_by_id').references(`${MetaTable.USERS}.id`);

    table.text('metaJson', 'longtext').defaultTo('{}');

    table.float('order');

    table.timestamps(true, true);
  });
};

const down = async (knex: Knex) => {
  await knex.schema.dropTable(MetaTable.DOCS_PAGE);
};

export { up, down };
