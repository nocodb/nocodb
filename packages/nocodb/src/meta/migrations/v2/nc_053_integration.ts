import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.createTable(MetaTable.BASE_SOURCES, (table) => {
    table.string('base_id', 120).index();
    table.string('source_id', 20).index();
    table.timestamps(true, true);
  });

  // create source project mapping by using sql query
  knex(MetaTable.BASE_SOURCES).insert(
    knex.select('id as source_id', 'base_id as base_id').from(MetaTable.BASES),
  );

  await knex.schema.alterTable(MetaTable.BASES, (table) => {
    table.string('base_id', 120).index();
    table.string('source_id', 20).index();
    table.timestamps(true, true);
  });
};

const down = async (knex: Knex) => {
  await knex.schema.dropSchema(MetaTable.BASE_SOURCES);
};

export { up, down };
