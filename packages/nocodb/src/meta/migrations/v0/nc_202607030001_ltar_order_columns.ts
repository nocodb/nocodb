import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

// Per-link ordering for v2 links: the junction (mm/associative) table gets two
// system Order columns, one per direction. Store references to those two junction
// columns on the relation meta so read/insert can find them. (Meta LTAR columns
// live in the v0 dated migration source, alongside fk_mm_child_column_id etc.)
const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.COL_RELATIONS, (table) => {
    table.string('fk_mm_child_order_column_id', 20);
    table.string('fk_mm_parent_order_column_id', 20);
  });
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.COL_RELATIONS, (table) => {
    table.dropColumn('fk_mm_child_order_column_id');
    table.dropColumn('fk_mm_parent_order_column_id');
  });
};

export { up, down };
