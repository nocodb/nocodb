import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.KANBAN_VIEW, (table) => {
    table.string('fk_grp_col_id', 20);
    table.foreign('fk_grp_col_id').references(`${MetaTable.COLUMNS}.id`);

    table.string('fk_cover_image_col_id', 20);
    table
      .foreign('fk_cover_image_col_id')
      .references(`${MetaTable.COLUMNS}.id`);

    table.text('meta');
  });
};

const down = async (knex) => {
  await knex.schema.alterTable(MetaTable.KANBAN_VIEW, (table) => {
    table.dropColumns('meta');
    table.dropColumns('fk_grp_col_id');
    table.dropColumns('fk_cover_image_col_id');
  });
};

export { up, down };
