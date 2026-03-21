import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.createTable(MetaTable.DATE_DEPENDENCY, (table) => {
    table.string('id', 20);
    table.string('base_id', 20);
    table.string('fk_workspace_id', 20);
    table.string('fk_model_id', 20);

    // The three date-related fields
    table.string('fk_start_date_field_id', 20);
    table.string('fk_end_date_field_id', 20);
    table.string('fk_duration_field_id', 20);

    // Optional: self-referencing HM link for predecessor/successor dependency
    table.string('fk_dependency_linkrow_field_id', 20);
    table.string('dependency_linkrow_role', 20).defaultTo('predecessors');

    table.string('dependency_connection_type', 20).defaultTo('end-to-start');

    table.string('dependency_buffer_type', 20).defaultTo('none');
    table.integer('dependency_buffer_days').defaultTo(0);

    table.boolean('include_weekends').defaultTo(true);
    table.boolean('is_active').defaultTo(true);

    table.timestamps(true, true);

    table.primary(['base_id', 'id']);

    table.index(['base_id', 'fk_workspace_id'], 'nc_date_dep_context_idx');
    table.index(['fk_model_id'], 'nc_date_dep_model_idx');
  });
};

const down = async (knex: Knex) => {
  await knex.schema.dropTableIfExists(MetaTable.DATE_DEPENDENCY);
};

export { up, down };
