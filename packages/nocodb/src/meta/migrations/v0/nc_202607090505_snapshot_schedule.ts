import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.createTable(MetaTable.SNAPSHOT_SCHEDULE, (table) => {
    table.string('id', 20).primary();
    table.string('base_id', 20).index();
    table.string('fk_workspace_id', 20);

    table.boolean('enabled').defaultTo(false);

    table.string('frequency', 20);
    table.text('config');
    table.string('cron_expression', 255);
    table.string('timezone', 255);

    table.integer('keep_last');
    table.integer('delete_after_days');

    table.dateTime('next_run_at').index();
    table.dateTime('last_run_at');

    table.string('created_by', 20);

    table.timestamps(true, true);
  });

  await knex.schema.alterTable(MetaTable.SNAPSHOT, (table) => {
    table.boolean('is_auto').defaultTo(false);
  });
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.SNAPSHOT, (table) => {
    table.dropColumn('is_auto');
  });

  await knex.schema.dropTableIfExists(MetaTable.SNAPSHOT_SCHEDULE);
};

export { up, down };
