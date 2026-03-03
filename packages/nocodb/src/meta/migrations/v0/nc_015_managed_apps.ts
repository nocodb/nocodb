import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  // Rename sandboxes table to managed_apps
  await knex.schema.renameTable(
    MetaTable.SANDBOXES_OLD,
    MetaTable.MANAGED_APPS,
  );

  // Rename sandbox_versions table to managed_app_versions
  await knex.schema.renameTable(
    MetaTable.SANDBOX_VERSIONS_OLD,
    MetaTable.MANAGED_APP_VERSIONS,
  );

  // Rename sandbox_deployment_logs table to managed_app_deployment_logs
  await knex.schema.renameTable(
    MetaTable.SANDBOX_DEPLOYMENT_LOGS_OLD,
    MetaTable.MANAGED_APP_DEPLOYMENT_LOGS,
  );

  // Rename columns in managed_app_versions table (formerly sandbox_versions)
  await knex.schema.alterTable(MetaTable.MANAGED_APP_VERSIONS, (table) => {
    table.renameColumn('fk_sandbox_id', 'fk_managed_app_id');
  });

  // Rename indexes in managed_app_versions table
  // Note: Index renaming varies by database. We'll drop and recreate them.
  await knex.schema.alterTable(MetaTable.MANAGED_APP_VERSIONS, (table) => {
    // Drop old indexes
    table.dropUnique(
      ['fk_sandbox_id', 'version'],
      'nc_sandbox_versions_unique_idx',
    );
    table.dropUnique(
      ['fk_sandbox_id', 'version_number'],
      'nc_sandbox_versions_number_unique_idx',
    );
    table.dropIndex(['fk_sandbox_id'], 'nc_sandbox_versions_sandbox_id_idx');
    table.dropIndex(
      ['fk_sandbox_id', 'status'],
      'nc_sandbox_versions_status_idx',
    );
    table.dropIndex(
      ['fk_sandbox_id', 'version_number'],
      'nc_sandbox_versions_ordering_idx',
    );
  });

  await knex.schema.alterTable(MetaTable.MANAGED_APP_VERSIONS, (table) => {
    // Create new indexes with updated names
    table.unique(['fk_managed_app_id', 'version'], {
      indexName: 'nc_managed_app_versions_unique_idx',
    });
    table.unique(['fk_managed_app_id', 'version_number'], {
      indexName: 'nc_managed_app_versions_number_unique_idx',
    });
    table.index(
      ['fk_managed_app_id'],
      'nc_managed_app_versions_managed_app_id_idx',
    );
    table.index(
      ['fk_managed_app_id', 'status'],
      'nc_managed_app_versions_status_idx',
    );
    table.index(
      ['fk_managed_app_id', 'version_number'],
      'nc_managed_app_versions_ordering_idx',
    );
  });

  // Rename columns in managed_app_deployment_logs table (formerly sandbox_deployment_logs)
  await knex.schema.alterTable(
    MetaTable.MANAGED_APP_DEPLOYMENT_LOGS,
    (table) => {
      table.renameColumn('fk_sandbox_id', 'fk_managed_app_id');
    },
  );

  // Rename indexes in managed_app_deployment_logs table
  await knex.schema.alterTable(
    MetaTable.MANAGED_APP_DEPLOYMENT_LOGS,
    (table) => {
      // Drop old indexes
      table.dropIndex(
        ['fk_sandbox_id'],
        'nc_sandbox_deployment_logs_sandbox_id_idx',
      );
    },
  );

  await knex.schema.alterTable(
    MetaTable.MANAGED_APP_DEPLOYMENT_LOGS,
    (table) => {
      // Create new indexes
      table.index(
        ['fk_managed_app_id'],
        'nc_managed_app_deployment_logs_managed_app_id_idx',
      );
    },
  );

  // Rename columns in bases table (PROJECT)
  await knex.schema.alterTable(MetaTable.PROJECT, (table) => {
    // Drop old indexes first
    table.dropIndex(
      ['sandbox_id', 'auto_update'],
      'nc_bases_sandbox_auto_update_idx',
    );
    table.dropIndex(['sandbox_version_id'], 'nc_bases_sandbox_version_id_idx');
    table.dropIndex(['sandbox_id'], 'nc_bases_sandbox_id_idx');
    table.dropIndex(['sandbox_master'], 'nc_bases_sandbox_master_idx');
  });

  await knex.schema.alterTable(MetaTable.PROJECT, (table) => {
    // Rename columns
    table.renameColumn('sandbox_master', 'managed_app_master');
    table.renameColumn('sandbox_id', 'managed_app_id');
    table.renameColumn('sandbox_version_id', 'managed_app_version_id');
  });

  await knex.schema.alterTable(MetaTable.PROJECT, (table) => {
    // Create new indexes
    table.index(['managed_app_master'], 'nc_bases_managed_app_master_idx');
    table.index(['managed_app_id'], 'nc_bases_managed_app_id_idx');
    table.index(
      ['managed_app_version_id'],
      'nc_bases_managed_app_version_id_idx',
    );
    table.index(
      ['managed_app_id', 'auto_update'],
      'nc_bases_managed_app_auto_update_idx',
    );
  });
};

const down = async (knex: Knex) => {
  // Revert columns in bases table (PROJECT)
  await knex.schema.alterTable(MetaTable.PROJECT, (table) => {
    // Drop new indexes
    table.dropIndex(
      ['managed_app_id', 'auto_update'],
      'nc_bases_managed_app_auto_update_idx',
    );
    table.dropIndex(
      ['managed_app_version_id'],
      'nc_bases_managed_app_version_id_idx',
    );
    table.dropIndex(['managed_app_id'], 'nc_bases_managed_app_id_idx');
    table.dropIndex(['managed_app_master'], 'nc_bases_managed_app_master_idx');
  });

  await knex.schema.alterTable(MetaTable.PROJECT, (table) => {
    // Rename columns back
    table.renameColumn('managed_app_version_id', 'sandbox_version_id');
    table.renameColumn('managed_app_id', 'sandbox_id');
    table.renameColumn('managed_app_master', 'sandbox_master');
  });

  await knex.schema.alterTable(MetaTable.PROJECT, (table) => {
    // Recreate old indexes
    table.index(['sandbox_master'], 'nc_bases_sandbox_master_idx');
    table.index(['sandbox_id'], 'nc_bases_sandbox_id_idx');
    table.index(['sandbox_version_id'], 'nc_bases_sandbox_version_id_idx');
    table.index(
      ['sandbox_id', 'auto_update'],
      'nc_bases_sandbox_auto_update_idx',
    );
  });

  // Revert indexes in managed_app_deployment_logs table
  await knex.schema.alterTable(
    MetaTable.MANAGED_APP_DEPLOYMENT_LOGS,
    (table) => {
      table.dropIndex(
        ['fk_managed_app_id'],
        'nc_managed_app_deployment_logs_managed_app_id_idx',
      );
    },
  );

  await knex.schema.alterTable(
    MetaTable.MANAGED_APP_DEPLOYMENT_LOGS,
    (table) => {
      table.index(
        ['fk_sandbox_id'],
        'nc_sandbox_deployment_logs_sandbox_id_idx',
      );
    },
  );

  // Revert columns in managed_app_deployment_logs table
  await knex.schema.alterTable(
    MetaTable.MANAGED_APP_DEPLOYMENT_LOGS,
    (table) => {
      table.renameColumn('fk_managed_app_id', 'fk_sandbox_id');
    },
  );

  // Revert indexes in managed_app_versions table
  await knex.schema.alterTable(MetaTable.MANAGED_APP_VERSIONS, (table) => {
    table.dropIndex(
      ['fk_managed_app_id', 'version_number'],
      'nc_managed_app_versions_ordering_idx',
    );
    table.dropIndex(
      ['fk_managed_app_id', 'status'],
      'nc_managed_app_versions_status_idx',
    );
    table.dropIndex(
      ['fk_managed_app_id'],
      'nc_managed_app_versions_managed_app_id_idx',
    );
    table.dropUnique(
      ['fk_managed_app_id', 'version_number'],
      'nc_managed_app_versions_number_unique_idx',
    );
    table.dropUnique(
      ['fk_managed_app_id', 'version'],
      'nc_managed_app_versions_unique_idx',
    );
  });

  await knex.schema.alterTable(MetaTable.MANAGED_APP_VERSIONS, (table) => {
    table.unique(['fk_sandbox_id', 'version'], {
      indexName: 'nc_sandbox_versions_unique_idx',
    });
    table.unique(['fk_sandbox_id', 'version_number'], {
      indexName: 'nc_sandbox_versions_number_unique_idx',
    });
    table.index(['fk_sandbox_id'], 'nc_sandbox_versions_sandbox_id_idx');
    table.index(['fk_sandbox_id', 'status'], 'nc_sandbox_versions_status_idx');
    table.index(
      ['fk_sandbox_id', 'version_number'],
      'nc_sandbox_versions_ordering_idx',
    );
  });

  // Revert columns in managed_app_versions table
  await knex.schema.alterTable(MetaTable.MANAGED_APP_VERSIONS, (table) => {
    table.renameColumn('fk_managed_app_id', 'fk_sandbox_id');
  });

  // Rename tables back
  await knex.schema.renameTable(
    MetaTable.MANAGED_APP_DEPLOYMENT_LOGS,
    MetaTable.SANDBOX_DEPLOYMENT_LOGS_OLD,
  );

  await knex.schema.renameTable(
    MetaTable.MANAGED_APP_VERSIONS,
    MetaTable.SANDBOX_VERSIONS_OLD,
  );

  await knex.schema.renameTable(
    MetaTable.MANAGED_APPS,
    MetaTable.SANDBOXES_OLD,
  );
};

export { up, down };
