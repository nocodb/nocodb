import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.FORM_VIEW, (table) => {
    table.datetime('starts_at').nullable();
    table.datetime('expires_at').nullable();
  });
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.FORM_VIEW, (table) => {
    table.dropColumn('starts_at');
    table.dropColumn('expires_at');
  });
};

export { up, down };
