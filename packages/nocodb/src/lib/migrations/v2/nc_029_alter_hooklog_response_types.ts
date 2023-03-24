import { MetaTable } from '../../utils/globals';
import type { Knex } from 'knex';

const up = async (knex: Knex) => {
  if (knex.client.config.client === 'mssql') {
    await knex.schema.alterTable(MetaTable.HOOK_LOGS, (table) => {
      table.dropColumn('response');
    });
    await knex.schema.alterTable(MetaTable.HOOK_LOGS, (table) => {
      table.text('response');
    });
  } else if (knex.client.config.client !== 'sqlite3') {
    await knex.schema.alterTable(MetaTable.HOOK_LOGS, (table) => {
      table.text('response').alter();
    });
  }
};

const down = async (knex) => {
  if (knex.client.config.client !== 'sqlite3') {
    await knex.schema.alterTable(MetaTable.HOOK_LOGS, (table) => {
      table.boolean('response').alter();
    });
  }
};

export { up, down };
