import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

// Soft-delete support for table syncs. When a synced (destination) table is
// sent to trash, its sync config + mappings are soft-deleted instead of being
// dropped, so restoring the table from trash can bring the sync back as-is.
const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.TABLE_SYNCS, (table) => {
    table.boolean('deleted').defaultTo(false);
  });
  await knex.schema.alterTable(MetaTable.TABLE_SYNC_MAPPINGS, (table) => {
    table.boolean('deleted').defaultTo(false);
  });
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.TABLE_SYNCS, (table) => {
    table.dropColumn('deleted');
  });
  await knex.schema.alterTable(MetaTable.TABLE_SYNC_MAPPINGS, (table) => {
    table.dropColumn('deleted');
  });
};

export { up, down };
