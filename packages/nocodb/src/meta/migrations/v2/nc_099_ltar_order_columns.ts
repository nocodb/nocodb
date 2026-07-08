import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

// Per-link ordering for v2 links: the junction (mm/associative) table gets two
// system Order columns, one per direction — orders records within each parent
// group and within each child group independently. Store references to those two
// junction columns on the relation meta so read/insert can find them.
const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.COL_RELATIONS, (t) => {
    t.string('fk_mm_child_order_column_id', 20);
    t.string('fk_mm_parent_order_column_id', 20);
  });
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.COL_RELATIONS, (t) => {
    t.dropColumn('fk_mm_child_order_column_id');
    t.dropColumn('fk_mm_parent_order_column_id');
  });
};

export { up, down };
