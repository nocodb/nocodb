import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.SYNC_CONFIGS, (table) => {
    table.boolean('deleted').defaultTo(false);
  });
  await knex.schema.alterTable(MetaTable.TABLE_SYNCS, (table) => {
    table.boolean('deleted').defaultTo(false);
  });

  await knex.schema.alterTable(MetaTable.SYNC_MAPPINGS, (table) => {
    table.string('status', 20).defaultTo('active');
  });
  await knex.schema.alterTable(MetaTable.TABLE_SYNC_MAPPINGS, (table) => {
    table.string('status', 20).defaultTo('active');
  });
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.SYNC_CONFIGS, (table) => {
    table.dropColumn('deleted');
  });
  await knex.schema.alterTable(MetaTable.TABLE_SYNCS, (table) => {
    table.dropColumn('deleted');
  });
  await knex.schema.alterTable(MetaTable.SYNC_MAPPINGS, (table) => {
    table.dropColumn('status');
  });
  await knex.schema.alterTable(MetaTable.TABLE_SYNC_MAPPINGS, (table) => {
    table.dropColumn('status');
  });
};

export { up, down };
