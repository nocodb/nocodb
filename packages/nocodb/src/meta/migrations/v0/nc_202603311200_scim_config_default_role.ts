import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.SCIM_CONFIG, (table) => {
    table.string('default_role', 50).nullable().defaultTo('no-access');
  });
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.SCIM_CONFIG, (table) => {
    table.dropColumn('default_role');
  });
};

export { up, down };
