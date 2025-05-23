import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('nc_event_log', (table) => {
    table.string('id').primary();
    table.string('fk_workspace_id');
    table.string('base_id');
    table.string('target');
    table.string('operation');
    table.json('payload');
    table.json('old_data');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.index(['fk_workspace_id', 'base_id', 'target']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('nc_event_log');
}
