import { MetaTable } from '../../../utils/globals';
import type { Knex } from 'knex';

const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.LAYOUT, (table) => {
    table.string('grid_gap');
    table.string('grid_padding_horizontal');
    table.string('grid_padding_vertical');
  });
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.LAYOUT, (table) => {
    table.dropColumn('grid_gap');
    table.dropColumn('grid_padding_horizontal');
    table.dropColumn('grid_padding_vertical');
  });
};

export { up, down };
