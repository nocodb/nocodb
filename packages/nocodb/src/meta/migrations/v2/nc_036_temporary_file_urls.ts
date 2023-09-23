import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.createTable(MetaTable.TEMPORARY_URLS, (table) => {
    table.text('key');
    table.text('url');
    table.dateTime('expires_at');
    table.timestamps(true, true);
    table.primary(['key', 'url']);
    table.index('key');
    table.index('url');
  });
};

const down = async (knex) => {
  knex.schema.dropTable(MetaTable.TEMPORARY_URLS);
};

export { up, down };
