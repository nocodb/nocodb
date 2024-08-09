import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.createTable(MetaTable.FILE_REFERENCES, (table) => {
    table.string('id', 20).primary().notNullable();
    table.string('storage');
    table.text('file_url');
    table.integer('file_size');
    table.string('fk_user_id', 20);
    table.string('fk_workspace_id', 20);
    table.string('base_id', 20);
    table.string('source_id', 20);
    table.string('fk_model_id', 20);
    table.string('fk_column_id', 20);
    table.boolean('is_external').defaultTo(false);
    table.boolean('deleted').defaultTo(false);
    table.timestamps(true, true);

    // TODO: Add indexes
  });
};

const down = async (knex: Knex) => {
  await knex.schema.dropTable(MetaTable.FILE_REFERENCES);
};

export { up, down };
