import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.ORG, (table) => {
    table.string('image').alter();
  });
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.ORG, (table) => {
    table.string('image').alter();
  });
};

export { up, down };
