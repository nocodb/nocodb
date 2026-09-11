import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.WORKSPACE, (table) => {
    table.boolean('suspended').defaultTo(false);
    // text, not varchar(255): operator case notes can run long.
    table.text('suspended_reason');
    table.timestamp('suspended_at');
    // reserved for the operator identity once admin actions are attributable.
    table.string('suspended_by');
  });

  await knex.schema.alterTable(MetaTable.PROJECT, (table) => {
    table.boolean('suspended').defaultTo(false);
    table.text('suspended_reason');
    table.timestamp('suspended_at');
    table.string('suspended_by');
  });
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.WORKSPACE, (table) => {
    table.dropColumn('suspended');
    table.dropColumn('suspended_reason');
    table.dropColumn('suspended_at');
    table.dropColumn('suspended_by');
  });

  await knex.schema.alterTable(MetaTable.PROJECT, (table) => {
    table.dropColumn('suspended');
    table.dropColumn('suspended_reason');
    table.dropColumn('suspended_at');
    table.dropColumn('suspended_by');
  });
};

export { up, down };
