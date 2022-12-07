import { MetaTable } from '../../utils/globals';
import { Knex } from 'knex';

const up = async (knex: Knex) => {
  await knex.schema.createTable(MetaTable.DOCS_PAGE, (table) => {
    table.string('id', 20).primary().notNullable();

    table.string('project_id', 20);
    table.foreign('project_id').references(`${MetaTable.PROJECT}.id`);

    table.string('title', 150).notNullable();
    table.text('content', 'longtext').notNullable();
    // todo: Handle the case when there is a slug duplicate
    table.string('slug', 150).notNullable();

    table.boolean('is_parent').defaultTo(false);
    table.string('parent_page_id', 20);
    table.foreign('parent_page_id').references(`${MetaTable.DOCS_PAGE}.id`);

    table.boolean('is_published').defaultTo(false);
    table.datetime('last_published_date').nullable();
    table.string('last_published_by_id', 20);
    table.foreign('last_published_by_id').references(`${MetaTable.USERS}.id`);

    table.datetime('last_updated_date').nullable();
    table.string('last_updated_by', 20);
    table.foreign('last_updated_by').references(`${MetaTable.USERS}.id`);

    table.datetime('created_date').nullable();
    table.string('created_by_id', 20);
    table.foreign('created_by_id').references(`${MetaTable.USERS}.id`);

    table.datetime('archived_date').nullable();
    table.string('archived_by_id', 20);
    table.foreign('archived_by_id').references(`${MetaTable.USERS}.id`);

    table.timestamps(true, true);
  });
};

const down = async (knex: Knex) => {
  await knex.schema.dropTable(MetaTable.DOCS_PAGE);
};

export { up, down };
