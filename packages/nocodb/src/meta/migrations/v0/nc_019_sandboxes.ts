import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  // Create sandboxes table for development environment feature
  await knex.schema.createTable(MetaTable.SANDBOXES, (table) => {
    table.string('id', 20).primary();
    table.string('fk_workspace_id', 20).notNullable();

    // Reference to the master (original) base
    table.string('master_base_id', 20).notNullable();

    // Reference to the sandbox (duplicate) base
    table.string('sandbox_base_id', 20).notNullable();

    // Who created the sandbox
    table.string('created_by', 20).notNullable();

    // Metadata (JSON) for additional info
    table.text('meta');

    // Timestamps
    table.timestamps(true, true);

    // Indexes for performance
    table.index(['fk_workspace_id'], 'nc_sandboxes_v2_workspace_id_idx');
    table.index(['master_base_id'], 'nc_sandboxes_v2_master_base_id_idx');
    table.index(['sandbox_base_id'], 'nc_sandboxes_v2_sandbox_base_id_idx');
    table.index(['created_by'], 'nc_sandboxes_v2_created_by_idx');
  });

  // Add sandbox-related columns to bases table (nc_bases_v2)
  await knex.schema.alterTable(MetaTable.PROJECT, (table) => {
    // Points to SANDBOXES.id if this base has an active sandbox
    table.string('fk_sandbox_id', 20);

    // Is this base a sandbox base?
    table.boolean('is_sandbox').defaultTo(false);
  });

  // Add indexes for sandbox relationship columns
  await knex.schema.alterTable(MetaTable.PROJECT, (table) => {
    table.index(['is_sandbox'], 'nc_bases_is_sandbox_idx');
    table.index(['fk_sandbox_id'], 'nc_bases_fk_sandbox_id_idx');
  });
};

const down = async (knex: Knex) => {
  // Drop indexes from bases table
  await knex.schema.alterTable(MetaTable.PROJECT, (table) => {
    table.dropIndex(['is_sandbox'], 'nc_bases_is_sandbox_idx');
    table.dropIndex(['fk_sandbox_id'], 'nc_bases_fk_sandbox_id_idx');
  });

  // Drop sandbox columns from bases table
  await knex.schema.alterTable(MetaTable.PROJECT, (table) => {
    table.dropColumn('is_sandbox');
    table.dropColumn('fk_sandbox_id');
  });

  // Drop sandboxes table
  await knex.schema.dropTable(MetaTable.SANDBOXES);
};

export { up, down };
