import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.createTable(
    MetaTable.TABLE_SYNC_COLUMN_MAPPINGS,
    (table) => {
      table.string('id', 20);
      table.string('base_id', 20);
      table.string('fk_workspace_id', 20);

      table.string('fk_table_sync_id', 20);
      table.string('fk_table_sync_mapping_id', 20);

      table.string('source_workspace_id', 20);
      table.string('source_base_id', 20);
      table.string('source_table_id', 20);
      table.string('source_column_id', 20);

      table.string('dest_base_id', 20);
      table.string('dest_table_id', 20);
      table.string('dest_column_id', 20);

      table.timestamps(true, true);

      table.primary(['base_id', 'id']);

      // Primary lookup: source col events (COLUMN_UPDATED, COLUMN_DELETED)
      // know the source col id and need to find all affected dest cols.
      table.index(
        ['source_workspace_id', 'source_base_id', 'source_column_id'],
        'nc_tscm_source_col_idx',
      );

      // Cascade cleanup when a table-mapping is dropped.
      table.index(['fk_table_sync_mapping_id'], 'nc_tscm_mapping_idx');

      // Per-sync cleanup on deleteSync.
      table.index(['fk_table_sync_id'], 'nc_tscm_sync_idx');

      // Reverse lookup when a dest col is dropped externally.
      table.index(['dest_column_id'], 'nc_tscm_dest_col_idx');
    },
  );
};

const down = async (knex: Knex) => {
  await knex.schema.dropTable(MetaTable.TABLE_SYNC_COLUMN_MAPPINGS);
};

export { up, down };
