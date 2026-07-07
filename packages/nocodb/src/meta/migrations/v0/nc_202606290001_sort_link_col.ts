import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

// Add `fk_lookup_link_col_id` to the Sort table so a sort can be scoped to a
// lookup/link column (the relation sub-query order) instead of a view — mirrors
// `fk_link_col_id` on the Filter table (nc_048_view_links), which already scopes
// the "limit records by conditions" filters to a lookup column.
const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.SORT, (table) => {
    table.string('fk_lookup_link_col_id', 20).index();
  });
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.SORT, (table) => {
    table.dropColumn('fk_lookup_link_col_id');
  });
};

export { up, down };
