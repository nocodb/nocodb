import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.COL_RELATIONS, (table) => {
    table.string('fk_child_view_id', 20).index();
  });
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.COL_RELATIONS, (table) => {
    table.dropColumn('fk_child_view_id');
  });
};

export { up, down };
