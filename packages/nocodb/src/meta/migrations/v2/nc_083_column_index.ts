import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.COLUMNS, (table) => {
    table.index(['fk_model_id', 'uidt'], 'idx_columns_model_composite');
  });
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.COLUMNS, (table) => {
    table.index(['fk_model_id', 'uidt'], 'idx_columns_model_composite');
  });
};

export { up, down };
