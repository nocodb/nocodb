import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  // Create sandboxes table
  await knex.schema.createTable(MetaTable.SANDBOXES, (table) => {
    table.string('id', 20).primary();
    table.string('fk_workspace_id', 20).notNullable();
    table.string('base_id', 20).notNullable().unique();

    table.string('title', 255).notNullable();
    table.text('description');

    // Owner of the sandbox app
    table.string('created_by', 20).notNullable();

    // Visibility in app store: 'public', 'private', 'unlisted'
    table.string('visibility', 20).notNullable().defaultTo('private');

    // Category for filtering in app store
    table.string('category', 255);

    // Installation/usage stats
    table.integer('install_count').unsigned().defaultTo(0);

    table.text('meta');

    // Soft delete support
    table.boolean('deleted').defaultTo(false);

    // Timestamps
    table.timestamps(true, true);

    // When first version was published
    table.timestamp('published_at');

    // Indexes for performance
    table.index(['fk_workspace_id'], 'nc_sandboxes_workspace_id_idx');
    table.index(['created_by'], 'nc_sandboxes_created_by_idx');
    table.index(['base_id'], 'nc_sandboxes_base_id_idx');
    table.index(['visibility'], 'nc_sandboxes_visibility_idx');
    table.index(['category'], 'nc_sandboxes_category_idx');
    table.index(['deleted'], 'nc_sandboxes_deleted_idx');
  });

  // Create sandbox_versions table to store serialized schemas for each published version
  await knex.schema.createTable(MetaTable.SANDBOX_VERSIONS, (table) => {
    table.string('id', 20).primary();
    table.string('fk_workspace_id', 20).notNullable();
    table.string('fk_sandbox_id', 20).notNullable();

    // Version information (semantic versioning)
    table.string('version', 20).notNullable();
    table.integer('version_number').unsigned().notNullable();

    // Status: 'draft' (editable) or 'published' (locked)
    // Once published, no more changes allowed on this version
    table.string('status', 20).notNullable().defaultTo('draft');

    // Serialized schema snapshot for this version (JSON)
    table.text('schema');

    // Optional release notes for this version
    table.text('release_notes');

    // Timestamps
    table.timestamps(true, true);

    // When this version was published (NULL for drafts)
    table.timestamp('published_at');

    // Composite unique constraint: one schema per version per sandbox
    table.unique(['fk_sandbox_id', 'version'], {
      indexName: 'nc_sandbox_versions_unique_idx',
    });
    table.unique(['fk_sandbox_id', 'version_number'], {
      indexName: 'nc_sandbox_versions_number_unique_idx',
    });

    // Indexes for performance
    table.index(['fk_sandbox_id'], 'nc_sandbox_versions_sandbox_id_idx');
    table.index(['fk_workspace_id'], 'nc_sandbox_versions_workspace_id_idx');
    table.index(['fk_sandbox_id', 'status'], 'nc_sandbox_versions_status_idx');
    table.index(
      ['fk_sandbox_id', 'version_number'],
      'nc_sandbox_versions_ordering_idx',
    );
  });

  // Add sandbox-related columns to bases table
  await knex.schema.alterTable(MetaTable.PROJECT, (table) => {
    // Is this base a sandbox master?
    table.boolean('sandbox_master').defaultTo(false);

    // Points to SANDBOXES.id (for both master and installed instances)
    table.string('sandbox_id', 20);

    // Current version: for master=draft/published being worked on, for installed=installed version
    // Points to SANDBOX_VERSIONS.id
    table.string('sandbox_version_id', 20);

    // For installed instances: auto-update to new published versions
    table.boolean('auto_update').defaultTo(true);
  });

  // Add indexes for sandbox relationship columns
  await knex.schema.alterTable(MetaTable.PROJECT, (table) => {
    table.index(['sandbox_master'], 'nc_bases_sandbox_master_idx');
    table.index(['sandbox_id'], 'nc_bases_sandbox_id_idx');
    table.index(['sandbox_version_id'], 'nc_bases_sandbox_version_id_idx');
    table.index(
      ['sandbox_id', 'auto_update'],
      'nc_bases_sandbox_auto_update_idx',
    );
  });

  // Create sandbox_deployment_logs table
  await knex.schema.createTable(MetaTable.SANDBOX_DEPLOYMENT_LOGS, (table) => {
    table.string('id', 20).primary();
    table.string('fk_workspace_id', 20).notNullable();

    // Installation reference
    table.string('base_id', 20).notNullable(); // The installed base
    table.string('fk_sandbox_id', 20).notNullable(); // The sandbox being deployed

    // Version tracking
    table.string('from_version_id', 20); // NULL for initial install
    table.string('to_version_id', 20).notNullable(); // Target version

    // Deployment status: 'pending', 'in_progress', 'success', 'failed'
    table.string('status', 20).notNullable().defaultTo('pending');

    // Deployment type: 'install', 'update'
    table.string('deployment_type', 20).notNullable();

    // Deployment details
    table.text('error_message'); // Error message if failed
    table.text('deployment_log'); // Detailed logs (JSON or text)
    table.text('meta'); // Additional metadata (JSON)

    // Timestamps
    table.timestamps(true, true);
    table.timestamp('started_at');
    table.timestamp('completed_at');

    // Indexes for performance
    table.index(
      ['fk_workspace_id'],
      'nc_sandbox_deployment_logs_workspace_id_idx',
    );
    table.index(['base_id'], 'nc_sandbox_deployment_logs_base_id_idx');
    table.index(['fk_sandbox_id'], 'nc_sandbox_deployment_logs_sandbox_id_idx');
    table.index(
      ['base_id', 'created_at'],
      'nc_sandbox_deployment_logs_base_created_idx',
    );
    table.index(['status'], 'nc_sandbox_deployment_logs_status_idx');
    table.index(
      ['from_version_id'],
      'nc_sandbox_deployment_logs_from_version_idx',
    );
    table.index(['to_version_id'], 'nc_sandbox_deployment_logs_to_version_idx');
  });
};

const down = async (knex: Knex) => {
  // Drop sandbox_deployment_logs table
  await knex.schema.dropTable(MetaTable.SANDBOX_DEPLOYMENT_LOGS);

  // Drop sandbox_versions table
  await knex.schema.dropTable(MetaTable.SANDBOX_VERSIONS);

  // Drop indexes from bases table
  await knex.schema.alterTable(MetaTable.PROJECT, (table) => {
    table.dropIndex(
      ['sandbox_id', 'auto_update'],
      'nc_bases_sandbox_auto_update_idx',
    );
    table.dropIndex(['sandbox_version_id'], 'nc_bases_sandbox_version_id_idx');
    table.dropIndex(['sandbox_id'], 'nc_bases_sandbox_id_idx');
    table.dropIndex(['sandbox_master'], 'nc_bases_sandbox_master_idx');
  });

  // Drop sandbox columns from bases table
  await knex.schema.alterTable(MetaTable.PROJECT, (table) => {
    table.dropColumn('auto_update');
    table.dropColumn('sandbox_version_id');
    table.dropColumn('sandbox_id');
    table.dropColumn('sandbox_master');
  });

  // Drop sandboxes table
  await knex.schema.dropTable(MetaTable.SANDBOXES);
};

export { up, down };
