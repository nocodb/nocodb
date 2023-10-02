import type { Knex } from 'knex';
import { MetaTableOldV2 } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTableOldV2.BASES, (table) => {
    table.boolean('deleted').defaultTo(false);
  });
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTableOldV2.BASES, (table) => {
    table.dropColumn('deleted');
  });
};

export { up, down };
