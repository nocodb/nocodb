import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.createTable(MetaTable.DOCS, (table) => {
    table.string('id', 20).primary();
    table.string('base_id', 20).notNullable();
    table.string('fk_workspace_id', 20);
    table.string('title', 512);
    table.text('content'); // ProseMirror JSON (stringified); altered to JSONB on PG below
    table.text('meta'); // JSON metadata (icon, cover, lock, etc.)
    table.float('order');
    table.string('parent_id', 20).nullable();
    table.boolean('deleted').defaultTo(false);
    table.boolean('has_children').defaultTo(false);
    table.integer('version').defaultTo(1);
    table.string('created_by', 20);
    table.string('updated_by', 20);
    table.timestamps(true, true);

    table.index(['base_id', 'fk_workspace_id']);
    table.index(['base_id', 'parent_id', 'order']);
  });

  // On PostgreSQL, use native JSONB for the content column for better
  // query performance and storage efficiency. TEXT is kept on other DBs.
  const isPg =
    knex.client.config.client === 'pg' ||
    knex.client.config.client === 'postgresql';

  if (isPg) {
    await knex.raw(
      `ALTER TABLE ?? ALTER COLUMN content TYPE jsonb USING content::jsonb`,
      [MetaTable.DOCS],
    );
  }
};

const down = async (knex: Knex) => {
  await knex.schema.dropTableIfExists(MetaTable.DOCS);
};

export { up, down };
