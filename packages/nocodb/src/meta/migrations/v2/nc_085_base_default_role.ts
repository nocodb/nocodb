import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.PROJECT, (table) => {
    table.string('default_role', 20);
  });
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.PROJECT, (table) => {
    table.dropColumn('default_role');
  });
};

export { up, down };
