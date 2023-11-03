import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.createTable(MetaTable.MODEL_STAT, (table) => {
    table.string('fk_workspace_id', 20);
    table.string('fk_model_id', 20);
    table.integer('row_count').defaultTo(0);
    table.timestamps(true, true);

    table.index('fk_workspace_id');
    table.primary(['fk_workspace_id', 'fk_model_id']);
  });
};

const down = async (knex: Knex) => {
  await knex.schema.dropTable(MetaTable.MODEL_STAT);
};

export { up, down };
