import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.createTable(MetaTable.SYNC_CONFIGS, (table) => {
    table.string('id', 20).primary().notNullable();

    table.string('fk_workspace_id', 20);
    table.string('base_id', 20);

    table.string('fk_integration_id', 20);
    table.string('fk_model_id', 20);

    table.string('sync_type');
    table.string('sync_trigger');
    table.string('sync_trigger_cron');
    table.string('sync_trigger_secret');
    table.string('sync_job_id');

    table.datetime('last_sync_at');
    table.datetime('next_sync_at');

    table.timestamps(true, true);

    table.index(
      ['fk_model_id', 'fk_integration_id'],
      'sync_configs_integration_model',
    );

    table.index(['base_id', 'fk_workspace_id'], 'nc_sync_configs_context');
  });

  await knex.schema.alterTable(MetaTable.MODELS, (table) => {
    table.boolean('synced').defaultTo(false);
  });

  await knex.schema.alterTable(MetaTable.COLUMNS, (table) => {
    table.boolean('readonly').defaultTo(false);
  });
};

const down = async (knex: Knex) => {
  await knex.schema.dropTable(MetaTable.SYNC_CONFIGS);

  await knex.schema.alterTable(MetaTable.MODELS, (table) => {
    table.dropColumn('synced');
  });

  await knex.schema.alterTable(MetaTable.COLUMNS, (table) => {
    table.dropColumn('readonly');
  });
};

export { up, down };
