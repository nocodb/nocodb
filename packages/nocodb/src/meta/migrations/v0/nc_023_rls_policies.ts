import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  // Create nc_rls_policies table
  await knex.schema.createTable(MetaTable.RLS_POLICIES, (table) => {
    table.string('id', 20).notNullable();
    table.string('fk_workspace_id', 20);
    table.string('base_id', 20).notNullable();
    table.string('source_id', 20);
    table.string('fk_model_id', 20).notNullable();
    table.string('title', 255);
    table.boolean('enabled').defaultTo(true);
    table.boolean('is_default').defaultTo(false);
    table.string('default_behavior', 20); // 'show_all', 'deny_all', 'condition'
    table.float('order');
    table.text('meta');
    table.string('created_by', 20);
    table.timestamps(true, true);

    // Primary key
    table.primary(['base_id', 'id'], 'nc_rls_policies_pk');

    // Indexes
    table.index(
      ['fk_model_id', 'enabled'],
      'nc_rls_policies_model_enabled_idx',
    );
    table.index(
      ['fk_model_id', 'is_default'],
      'nc_rls_policies_model_default_idx',
    );
  });

  // Create nc_rls_policy_subjects table (mirrors nc_permission_subjects pattern)
  await knex.schema.createTable(MetaTable.RLS_POLICY_SUBJECTS, (table) => {
    table.string('fk_rls_policy_id', 20).notNullable();
    table.string('subject_type', 255).notNullable(); // 'user', 'team', 'role'
    table.string('subject_id', 255).notNullable(); // User ID, team ID, or role string
    table.string('fk_workspace_id', 20);
    table.string('base_id', 20);
    table.timestamps(true, true);

    // Primary key (composite — prevents duplicate assignments)
    table.primary(
      ['fk_rls_policy_id', 'subject_type', 'subject_id'],
      'nc_rls_policy_subjects_pk',
    );

    // Index for context-based lookups
    table.index(
      ['fk_workspace_id', 'base_id'],
      'nc_rls_policy_subjects_context_idx',
    );
  });

  // Extend existing filter table with fk_rls_policy_id
  await knex.schema.alterTable(MetaTable.FILTER_EXP, (table) => {
    table.string('fk_rls_policy_id', 20);
    table.index(['fk_rls_policy_id'], 'nc_filter_exp_rls_policy_idx');
  });
};

const down = async (knex: Knex) => {
  // Remove fk_rls_policy_id from filter table
  await knex.schema.alterTable(MetaTable.FILTER_EXP, (table) => {
    table.dropIndex(['fk_rls_policy_id'], 'nc_filter_exp_rls_policy_idx');
    table.dropColumn('fk_rls_policy_id');
  });

  // Drop tables in reverse order
  await knex.schema.dropTableIfExists(MetaTable.RLS_POLICY_SUBJECTS);
  await knex.schema.dropTableIfExists(MetaTable.RLS_POLICIES);
};

export { up, down };
