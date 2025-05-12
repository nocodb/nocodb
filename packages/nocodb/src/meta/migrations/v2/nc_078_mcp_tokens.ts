import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';
import { isEE } from '~/utils';

const up = async (knex: Knex) => {
  await knex.schema.createTable(MetaTable.MCP_TOKENS, (table) => {
    table.string('id', 20).primary();
    table.string('title', 512);
    table.string('base_id', 20);
    table.string('expires_at');

    table.float('order');

    if (isEE) {
      table.string('fk_workspace_id', 20);
    }

    table.string('fk_user_id', 20);

    table.string('status', 20);

    table.timestamps(true, true);

    if (isEE) {
      table.index(['fk_workspace_id', 'base_id'], 'nc_mc_tokens_context');
    }
  });
};

const down = async (knex: Knex) => {
  await knex.schema.dropTableIfExists(MetaTable.MCP_TOKENS);
};

export { up, down };
