import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.COL_BUTTON, (table) => {
    table.string('fk_form_view_id', 20);
  });
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.COL_BUTTON, (table) => {
    table.dropColumn('fk_form_view_id');
  });
};

export { up, down };
