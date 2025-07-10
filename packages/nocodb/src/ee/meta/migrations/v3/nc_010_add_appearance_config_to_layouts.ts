import type { Knex } from 'knex';
import { MetaTableOldV2 } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTableOldV2.LAYOUT, (table) => {
    table.string('grid_gap');
    table.string('grid_padding_horizontal');
    table.string('grid_padding_vertical');
  });
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTableOldV2.LAYOUT, (table) => {
    table.dropColumn('grid_gap');
    table.dropColumn('grid_padding_horizontal');
    table.dropColumn('grid_padding_vertical');
  });
};

export { up, down };
