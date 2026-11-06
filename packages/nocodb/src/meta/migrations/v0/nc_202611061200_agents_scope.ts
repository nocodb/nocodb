import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.AGENTS, (table) => {
    table.string('scope', 20);
    table.string('owned_by', 20);
  });
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.AGENTS, (table) => {
    table.dropColumn('scope');
    table.dropColumn('owned_by');
  });
};

export { up, down };
