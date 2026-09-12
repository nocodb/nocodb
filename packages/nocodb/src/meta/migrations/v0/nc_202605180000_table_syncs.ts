import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.VIEWS, (table) => {
    table.boolean('allow_sync').defaultTo(false);
  });

  await knex.schema.createTable(MetaTable.TABLE_SYNCS, (table) => {
    table.string('id', 20);
    table.string('base_id', 20);
    table.string('fk_workspace_id', 20).notNullable();

    table.string('title', 255).notNullable();

    table.text('selected_fields');

    table.string('on_delete_action', 32);
    table.string('sync_trigger', 32);

    table.string('status', 16).defaultTo('active');
    table.text('last_error');
    table.dateTime('last_synced_at');
    table.string('sync_job_id', 255);

    table.string('source_input_mode', 16).notNullable().defaultTo('browse');

    table.string('created_by', 20);
    table.string('updated_by', 20);
    table.timestamps(true, true);

    table.primary(['base_id', 'id']);
    table.index(['fk_workspace_id', 'base_id'], 'nc_ts_ws_base_idx');
  });

  await knex.schema.createTable(MetaTable.TABLE_SYNC_MAPPINGS, (table) => {
    table.string('id', 20);
    table.string('base_id', 20);
    table.string('fk_workspace_id', 20);

    table.string('fk_table_sync_id', 20);

    table.string('source_workspace_id', 20);
    table.string('source_base_id', 20);
    table.string('source_table_id', 20);
    table.string('source_view_id', 20);
    table.string('source_uuid', 255);
    table.text('source_password_hash');

    table.string('dest_base_id', 20);
    table.string('dest_table_id', 20);

    table.string('role', 16);

    table.timestamps(true, true);

    table.primary(['base_id', 'id']);
    table.index(
      ['source_workspace_id', 'source_base_id', 'source_table_id'],
      'nc_tsm_source_idx',
    );

    table.index(['source_uuid'], 'nc_tsm_source_uuid_idx');
    table.index(['fk_table_sync_id'], 'nc_tsm_table_sync_idx');
  });
};

const down = async (knex: Knex) => {
  await knex.schema.dropTable(MetaTable.TABLE_SYNC_MAPPINGS);
  await knex.schema.dropTable(MetaTable.TABLE_SYNCS);

  await knex.schema.alterTable(MetaTable.VIEWS, (table) => {
    table.dropColumn('allow_sync');
  });
};

export { up, down };
