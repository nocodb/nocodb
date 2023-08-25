import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  if (knex.client.config.client === 'mssql') {
    await knex.schema.alterTable(MetaTable.HOOK_LOGS, (table) => {
      table.dropColumn('payload');
    });
    await knex.schema.alterTable(MetaTable.HOOK_LOGS, (table) => {
      table.text('payload');
    });
  } else if (knex.client.config.client !== 'sqlite3') {
    await knex.schema.alterTable(MetaTable.HOOK_LOGS, (table) => {
      table.text('payload').alter();
    });
  }
};

const down = async (knex) => {
  if (knex.client.config.client !== 'sqlite3') {
    await knex.schema.alterTable(MetaTable.HOOK_LOGS, (table) => {
      table.boolean('payload').alter();
    });
  }
};

export { up, down };
