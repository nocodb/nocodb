import { OnDeleteAction } from 'nocodb-sdk';
import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.createTable(MetaTable.SYNC_MAPPINGS, (table) => {
    table.string('id', 20).primary().notNullable();

    table.string('fk_workspace_id', 20);
    table.string('base_id', 20);

    table.string('fk_sync_config_id', 20);

    table.string('target_table', 255);
    table.string('fk_model_id', 20); // target model id

    table.timestamps(true, true);

    table.index(['base_id', 'fk_workspace_id'], 'nc_sync_mappings_context');
    table.index('fk_sync_config_id', 'nc_sync_mappings_sync_config_idx');
  });

  await knex.schema.alterTable(MetaTable.SYNC_CONFIGS, (table) => {
    table.string('on_delete_action', 255).defaultTo(OnDeleteAction.MarkDeleted); // delete, mark_deleted
  });
};

const down = async (knex: Knex) => {
  await knex.schema.dropTable(MetaTable.SYNC_MAPPINGS);

  await knex.schema.alterTable(MetaTable.SYNC_CONFIGS, (table) => {
    table.dropColumn('on_delete_action');
  });
};

export { up, down };
