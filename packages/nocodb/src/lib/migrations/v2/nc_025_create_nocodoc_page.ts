import { MetaTable } from '../../utils/globals';
import { Knex } from 'knex';

const up = async (knex: Knex) => {
  await knex.schema.createTable(MetaTable.DOCS_PAGE, (table) => {
    table.string('id', 20).primary().notNullable();

    table.string('project_id', 128);
    table.foreign('project_id').references(`${MetaTable.PROJECT}.id`);

    table.string('title', 50).notNullable();
    table.string('content', 10000).notNullable();

    table.boolean('is_parent').defaultTo(false);
    table.boolean('is_published').defaultTo(false);

    table.timestamps(true, true);
  });
};

const down = async (knex: Knex) => {
  await knex.schema.dropTable(MetaTable.DOCS_PAGE);
};

export { up, down };
