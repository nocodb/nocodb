import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.WORKSPACE, (table) => {
    table.boolean('loyal').defaultTo(false);
    table.boolean('loyalty_discount_used').defaultTo(false);
  });

  // Mark all existing workspaces as loyal
  await knex(MetaTable.WORKSPACE).update({
    loyal: true,
    loyalty_discount_used: false,
  });
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.WORKSPACE, (table) => {
    table.dropColumn('loyal');
    table.dropColumn('loyalty_discount_used');
  });
};

export { up, down };
