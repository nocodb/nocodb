import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.createTable(MetaTable.WORKFLOWS, (table) => {
    table.string('id', 20).primary().notNullable();
    table.string('title', 255).notNullable();
    table.text('description');

    table.string('fk_workspace_id', 20);
    table.string('base_id', 20);

    table.boolean('enabled').defaultTo(false);

    table.text('nodes');
    table.text('edges');

    table.text('meta'); // JSON field for additional metadata like settings

    table.integer('trigger_count').defaultTo(0);

    table.float('order');

    table.timestamps(true, true);

    // Indexes for fast lookups
    table.index(['base_id', 'fk_workspace_id'], 'nc_workflows_context_idx');
  });

  await knex.schema.createTable(MetaTable.WORKFLOW_EXECUTIONS, (table) => {
    table.string('id', 20).primary().notNullable();
    table.string('fk_workspace_id', 20);
    table.string('base_id', 20);
    table.string('fk_workflow_id', 20).notNullable();

    table.text('workflow_data');
    table.text('execution_data');

    table.boolean('finished').defaultTo(false);
    table.timestamp('started_at');
    table.timestamp('finished_at');
    table.string('status', 50); // e.g., 'success', 'error', 'in_progress'

    table.timestamps(true, true);

    // Indexes for fast lookups
    table.index(
      ['base_id', 'fk_workspace_id'],
      'nc_workflow_executions_context_idx',
    );
    table.index(['fk_workflow_id'], 'nc_workflow_executions_workflow_idx');
  });

  await knex.schema.createTable(MetaTable.DEPENDENCY_TRACKER, (table) => {
    table.string('id', 20).primary().notNullable();
    table.string('fk_workspace_id', 20);
    table.string('base_id', 20);

    table.string('source_type', 50).notNullable();
    table.string('source_id', 20).notNullable();
    table.string('dependent_type', 50).notNullable();
    table.string('dependent_id', 20).notNullable();

    table.timestamps(true, true);

    // Indexes for fast lookups
    table.index(
      ['base_id', 'fk_workspace_id'],
      'nc_dependency_tracker_context_idx',
    );
    table.index(
      ['source_type', 'source_id'],
      'nc_dependency_tracker_source_idx',
    );
    table.index(
      ['dependent_type', 'dependent_id'],
      'nc_dependency_tracker_dependent_idx',
    );
  });
};

const down = async (knex: Knex) => {
  await knex.schema.dropTable(MetaTable.WORKFLOW_EXECUTIONS);
  await knex.schema.dropTable(MetaTable.WORKFLOWS);
  await knex.schema.dropTable(MetaTable.DEPENDENCY_TRACKER);
};

export { up, down };
