import type { Knex } from 'knex';
import { MetaTableOldV2 } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTableOldV2.WORKFLOWS, (table) => {
    table.dropColumn('trigger_count');
    table.text('draft');
  });
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTableOldV2.WORKFLOWS, (table) => {
    table.integer('trigger_count').defaultTo(0);
    table.dropColumn('draft');
  });
};

export { up, down };
