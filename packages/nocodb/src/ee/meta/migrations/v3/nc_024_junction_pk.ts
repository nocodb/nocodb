import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.WORKSPACE_USER, (table) => {
    table.primary(['fk_workspace_id', 'fk_user_id']);
  });
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.WORKSPACE_USER, (table) => {
    table.dropPrimary();
  });
};

export { up, down };
