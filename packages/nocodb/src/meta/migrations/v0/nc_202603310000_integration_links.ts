import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.createTable(MetaTable.INTEGRATION_LINKS, (table) => {
    table.string('id', 20).notNullable().primary();
    table.string('fk_integration_id', 20);
    table.string('base_id', 20);
    table.string('fk_workspace_id', 20);
    table.string('created_by', 20);
    table.timestamps(true, true);

    table.unique(['fk_integration_id', 'base_id']);

    table.index(['fk_workspace_id', 'base_id'], 'nc_il_ws_base_idx');
    table.index(['fk_integration_id'], 'nc_il_integration_idx');
  });

  // Add is_restricted column to integrations table
  // false (default) = available to all bases (legacy/workspace-created)
  // true = only available to explicitly linked bases (base-created)
  await knex.schema.alterTable(MetaTable.INTEGRATIONS, (table) => {
    table.boolean('is_restricted').defaultTo(false);
  });
};

const down = async (knex: Knex) => {
  await knex.schema.dropTableIfExists(MetaTable.INTEGRATION_LINKS);

  await knex.schema.alterTable(MetaTable.INTEGRATIONS, (table) => {
    table.dropColumn('is_restricted');
  });
};

export { up, down };
