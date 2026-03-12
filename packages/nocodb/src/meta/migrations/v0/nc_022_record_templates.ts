import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  if (!(await knex.schema.hasTable(MetaTable.RECORD_TEMPLATES))) {
    await knex.schema.createTable(MetaTable.RECORD_TEMPLATES, (table) => {
      table.string('id', 20).notNullable();
      table.string('base_id', 20).notNullable().index();
      table.string('fk_workspace_id', 20).index();
      table.string('fk_model_id', 20).notNullable().index();
      table.string('title', 255).notNullable();
      table.text('description');
      table.text('template_data', 'mediumtext').notNullable();
      table.integer('usage_count').defaultTo(0);
      table.boolean('enabled').defaultTo(true);
      table.string('created_by', 20);
      table.timestamps(true, true);
      table.primary(['base_id', 'id']);
    });
  }
};

const down = async (knex: Knex) => {
  await knex.schema.dropTableIfExists(MetaTable.RECORD_TEMPLATES);
};

export { up, down };
