import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.createTable(MetaTable.SSO_CLIENT, (table) => {
    table.string('id', 20).primary();

    table.string('type', 20);
    table.string('title', 255);

    table.boolean('enabled').defaultTo(true);

    table.text('config');

    table.string('fk_user_id', 20).index();
    table.string('fk_workspace_id', 20).index();

    table.boolean('deleted').defaultTo(false);
    table.float('order');
    table.timestamps(true, true);
  });
};

const down = async (_knex) => {
  // todo:
};

export { up, down };
