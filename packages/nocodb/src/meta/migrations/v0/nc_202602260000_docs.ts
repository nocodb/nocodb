import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  const hasTable = await knex.schema.hasTable(MetaTable.DOCS);
  if (!hasTable) {
    await knex.schema.createTable(MetaTable.DOCS, (table) => {
      table.string('id', 20).primary();
      table.string('base_id', 20);
      table.string('fk_workspace_id', 20);
      table.string('title', 512);
      table.text('content'); // ProseMirror JSON (stringified)
      table.text('meta'); // JSON metadata (icon, cover, lock, etc.)
      table.float('order');
      table.string('parent_id', 20).nullable(); // Future nesting support
      table.integer('version').defaultTo(1);
      table.string('created_by', 20);
      table.string('updated_by', 20);
      table.timestamps(true, true);

      table.index(['base_id', 'fk_workspace_id']);
      table.index(['base_id', 'parent_id', 'order']);
    });
  }
};

const down = async (knex: Knex) => {
  await knex.schema.dropTableIfExists(MetaTable.DOCS);
};

export { up, down };
