import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  // Create sandboxes table
  await knex.schema.createTable(MetaTable.SANDBOXES, (table) => {
    table.string('id', 20).primary();
    table.string('fk_workspace_id', 20).notNullable();
    table.string('base_id', 20).notNullable();

    table.string('title', 255).notNullable();
    table.text('description');

    // Owner of the sandbox app
    table.string('created_by', 20).notNullable();

    // Sandbox status: 'published', 'draft', 'archived'
    table.string('status', 20).notNullable().defaultTo('draft');

    // Visibility in app store: 'public', 'private', 'unlisted'
    table.string('visibility', 20).notNullable().defaultTo('private');

    // Version information
    table.string('version', 20).notNullable().defaultTo('1.0.0');

    // Category for filtering in app store
    table.string('category', 255);

    // Installation/usage stats
    table.integer('install_count').unsigned().notNullable().defaultTo(0);

    table.text('meta');

    // Timestamps
    table.timestamps(true, true);
    table.timestamp('published_at');

    // Indexes for performance
    table.index(['fk_workspace_id'], 'nc_sandboxes_workspace_id_idx');
    table.index(['created_by'], 'nc_sandboxes_created_by_idx');
    table.index(['base_id'], 'nc_sandboxes_base_id_idx');
    table.index(['status', 'visibility'], 'nc_sandboxes_status_visibility_idx');
  });

  // Add sandbox-related columns to bases table
  await knex.schema.alterTable(MetaTable.PROJECT, (table) => {
    // If this base is a sandbox master (template)
    table.string('sandbox_id', 20);

    // If this base is an installed instance from a sandbox
    table.string('sandbox_source_id', 20);

    // Schema locked flag - prevents schema modifications on installed sandboxes
    table.boolean('schema_locked').defaultTo(false);
  });

  // Add indexes for sandbox relationship columns
  await knex.schema.alterTable(MetaTable.PROJECT, (table) => {
    table.index(['sandbox_id'], 'nc_bases_sandbox_id_idx');
    table.index(['sandbox_source_id'], 'nc_bases_sandbox_source_id_idx');
  });
};

const down = async (knex: Knex) => {
  // Drop indexes from bases table
  await knex.schema.alterTable(MetaTable.PROJECT, (table) => {
    table.dropIndex(['sandbox_source_id'], 'nc_bases_sandbox_source_id_idx');
    table.dropIndex(['sandbox_id'], 'nc_bases_sandbox_id_idx');
  });

  // Drop sandbox columns from bases table
  await knex.schema.alterTable(MetaTable.PROJECT, (table) => {
    table.dropColumn('schema_locked');
    table.dropColumn('sandbox_source_id');
    table.dropColumn('sandbox_id');
  });

  // Drop sandboxes table
  await knex.schema.dropTable(MetaTable.SANDBOXES);
};

export { up, down };
