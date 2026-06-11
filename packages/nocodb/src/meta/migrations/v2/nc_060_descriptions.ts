import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const alterColumnToText = async (knex: Knex, table: string) => {
  await knex.schema.alterTable(table, (t) => {
    t.text('description').alter();
  });
};

const alterColumnToString = async (knex: Knex, table: string) => {
  await knex.schema.alterTable(table, (t) => {
    t.string('description', 255).alter();
  });
};

const up = async (knex: Knex) => {
  await alterColumnToText(knex, MetaTable.COLUMNS);
  await alterColumnToText(knex, MetaTable.MODELS);
  await alterColumnToText(knex, MetaTable.VIEWS);
};

const down = async (knex: Knex) => {
  await alterColumnToString(knex, MetaTable.COLUMNS);
  await alterColumnToString(knex, MetaTable.MODELS);
  await alterColumnToString(knex, MetaTable.VIEWS);
};

export { up, down };
