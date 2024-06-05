import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.COL_RELATIONS, (table) => {
    table.string('fk_target_view_id', 20).index();
  });

  await knex.schema.alterTable(MetaTable.FILTER_EXP, (table) => {
    table.string('fk_link_col_id', 20).index();
    table.string('fk_value_col_id', 20).index();
  });
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.COL_RELATIONS, (table) => {
    table.dropColumn('fk_target_view_id');
  });

  await knex.schema.alterTable(MetaTable.FILTER_EXP, (table) => {
    table.dropColumn('fk_link_col_id');
    table.dropColumn('fk_value_col_id');
  });
};

export { up, down };
