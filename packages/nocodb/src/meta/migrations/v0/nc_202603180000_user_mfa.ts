import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.USERS, (table) => {
    table.text('totp_secret').nullable();
    table.boolean('totp_enabled').defaultTo(false);
    table.text('totp_backup_codes').nullable();
  });
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.USERS, (table) => {
    table.dropColumn('totp_secret');
    table.dropColumn('totp_enabled');
    table.dropColumn('totp_backup_codes');
  });
};

export { up, down };
