import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.createTable(MetaTable.RECORD_TEMPLATES, (table) => {
    table.string('id', 20).primary();
    table.string('base_id', 20).notNullable();
    table.string('source_id', 20).notNullable();
    table.string('title', 255).notNullable();
    table.text('description');
    table.text('template_data', 'longtext').notNullable();
    table.integer('usage_count').defaultTo(0);
    table.boolean('enabled').defaultTo(true);
    table.string('created_by', 20);
    table.timestamps(true, true);

    // Indexes
    table.index('base_id');
    table.index('source_id');
    table.index(['base_id', 'source_id']);

    // Foreign keys
    table.foreign('base_id').references('id').inTable(MetaTable.PROJECT).onDelete('CASCADE');
    table.foreign('source_id').references('id').inTable(MetaTable.SOURCES).onDelete('CASCADE');
    table.foreign('created_by').references('id').inTable(MetaTable.USERS).onDelete('SET NULL');
  });
};

const down = async (knex: Knex) => {
  await knex.schema.dropTable(MetaTable.RECORD_TEMPLATES);
};

export { up, down };
