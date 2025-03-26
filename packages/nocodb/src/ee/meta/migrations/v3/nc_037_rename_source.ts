import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  if (await knex.schema.hasTable(MetaTable.SOURCES_OLD)) {
    await knex.schema.renameTable(MetaTable.SOURCES_OLD, MetaTable.SOURCES);
  }
};

const down = async (knex: Knex) => {
  if (await knex.schema.hasTable(MetaTable.SOURCES)) {
    await knex.schema.renameTable(MetaTable.SOURCES, MetaTable.SOURCES_OLD);
  }
};

export { up, down };
