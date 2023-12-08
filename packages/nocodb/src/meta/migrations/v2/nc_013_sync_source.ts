import type { Knex } from 'knex';
import { MetaTable, MetaTableOldV2 } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.createTable(MetaTable.SYNC_SOURCE, (table) => {
    table.string('id', 20).primary().notNullable();

    table.string('title');
    table.string('type');
    table.text('details');
    table.boolean('deleted');
    table.boolean('enabled').defaultTo(true);
    table.float('order');

    table.string('project_id', 128);
    table.foreign('project_id').references(`${MetaTableOldV2.PROJECT}.id`);
    table.string('fk_user_id', 20);
    table.foreign('fk_user_id').references(`${MetaTable.USERS}.id`);

    table.timestamps(true, true);
  });

  await knex.schema.createTable(MetaTable.SYNC_LOGS, (table) => {
    table.string('id', 20).primary().notNullable();

    table.string('project_id', 128);
    table.string('fk_sync_base_id', 20);
    // table
    //   .foreign('fk_sync_base_id')
    //   .references(`${MetaTableOldV2.BASES}.id`);

    table.integer('time_taken');
    table.string('status');
    table.text('status_details');

    table.timestamps(true, true);
  });
};

const down = async (knex) => {
  await knex.schema.dropTable(MetaTable.SYNC_LOGS);
  await knex.schema.dropTable(MetaTable.SYNC_SOURCE);
};

export { up, down };
