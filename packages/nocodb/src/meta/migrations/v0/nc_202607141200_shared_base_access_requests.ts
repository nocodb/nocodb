import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  const exists = await knex.schema.hasTable(
    MetaTable.SHARED_BASE_ACCESS_REQUESTS,
  );
  if (exists) return;

  await knex.schema.createTable(
    MetaTable.SHARED_BASE_ACCESS_REQUESTS,
    (table) => {
      table.string('id', 20).primary();
      table.string('fk_workspace_id', 20);
      table.string('base_id', 20).notNullable();
      table.string('fk_user_id', 20).notNullable();
      table.string('requested_role', 20).notNullable().defaultTo('editor');
      table.string('status', 20).notNullable().defaultTo('pending');
      table.text('message');
      table.string('reviewed_by', 20);
      table.timestamp('reviewed_at');
      table.timestamps(true, true);

      table.unique(['base_id', 'fk_user_id'], 'nc_sbar_base_user_unique');
      table.index(['base_id', 'status'], 'nc_sbar_base_status_idx');
      table.index(['fk_user_id'], 'nc_sbar_user_idx');
      table.index(['base_id', 'fk_workspace_id'], 'nc_sbar_context_idx');
    },
  );
};

const down = async (knex: Knex) => {
  await knex.schema.dropTableIfExists(MetaTable.SHARED_BASE_ACCESS_REQUESTS);
};

export { up, down };
