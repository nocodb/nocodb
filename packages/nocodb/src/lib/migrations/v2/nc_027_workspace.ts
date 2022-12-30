import { Knex } from 'knex';
import { MetaTable } from '../../utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.createTable(MetaTable.WORKSPACE, (table) => {
    table.string('id', 20).primary();
    table.string('title', 255);
    table.text('description');

    table.text('meta');

    // todo: set fk
    table.string('fk_user_id', 20);

    table.boolean('deleted').defaultTo(false);
    table.timestamp('deleted_at');
    table.float('order');
    table.timestamps(true, true);
  });

  await knex.schema.createTable(MetaTable.WORKSPACE_USER, (table) => {
    // todo: set fk
    table.string('fk_workspace_id', 20);
    table.string('fk_user_id', 20);

    table.string('roles', 255);

    // todo: move to a separate table if required
    table.string('invite_token', 255);
    table.boolean('invite_accepted').defaultTo(false);

    table.boolean('deleted').defaultTo(false);

    table.timestamp('deleted_at');
    table.float('order');
    table.timestamps(true, true);
  });

  await knex.schema.alterTable(MetaTable.PROJECT, (table) => {
    // todo: set fk
    table.string('fk_workspace_id', 20);
  });
};

const down = async (_knex) => {
  // todo:
};

export { up, down };
