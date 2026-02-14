import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  if (!(await knex.schema.hasTable(MetaTable.RECORD_TEMPLATES))) {
    await knex.schema.createTable(MetaTable.RECORD_TEMPLATES, (table) => {
      table.string('id', 20).notNullable();
      table.string('base_id', 20).notNullable();
      table.string('fk_workspace_id', 20);
      table.string('source_id', 20).notNullable();
      table.string('title', 255).notNullable();
      table.text('description');
      table.text('template_data').notNullable();
      table.integer('usage_count').defaultTo(0);
      table.string('created_by', 20);
      table.timestamps(true, true);
      table.primary(['base_id', 'id']);
    });
  }

  // Use raw SQL for indexes to avoid PG transaction abort on duplicates
  await knex.raw(
    `CREATE INDEX IF NOT EXISTS "nc_record_templates_base_id_idx" ON "${MetaTable.RECORD_TEMPLATES}" ("base_id")`,
  );
  await knex.raw(
    `CREATE INDEX IF NOT EXISTS "nc_record_templates_source_id_idx" ON "${MetaTable.RECORD_TEMPLATES}" ("source_id")`,
  );
  await knex.raw(
    `CREATE INDEX IF NOT EXISTS "nc_record_templates_base_source_idx" ON "${MetaTable.RECORD_TEMPLATES}" ("base_id", "source_id")`,
  );
  await knex.raw(
    `CREATE INDEX IF NOT EXISTS "nc_record_templates_workspace_id_idx" ON "${MetaTable.RECORD_TEMPLATES}" ("fk_workspace_id")`,
  );
};

const down = async (knex: Knex) => {
  await knex.schema.dropTableIfExists(MetaTable.RECORD_TEMPLATES);
};

export { up, down };
