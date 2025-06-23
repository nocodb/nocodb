import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  // Step 1: Rename the existing table
  await knex.schema.renameTable(MetaTable.AUDIT, `${MetaTable.AUDIT}_old`);

  // Step 2: Recreate the table with the new schema
  await knex.schema.createTable(MetaTable.AUDIT, (table) => {
    if (knex.client.config.client === 'pg') {
      table.uuid('id');
    } else {
      table.string('id', 36);
    }

    table.string('user', 255);
    table.string('ip', 255);
    table.string('source_id', 20);
    table.string('base_id', 20);
    table.string('fk_model_id', 20);
    table.string('row_id', 255);
    table.string('op_type', 255);
    table.string('op_sub_type', 255);
    table.string('status', 255);
    table.text('description');
    table.text('details');
    table.string('fk_user_id', 20);
    table.string('fk_ref_id', 20);

    if (knex.client.config.client === 'pg') {
      table.uuid('fk_parent_id');
    } else {
      table.string('fk_parent_id', 36);
    }

    table.string('fk_workspace_id', 20);
    table.string('fk_org_id', 20); // new column
    table.text('user_agent');
    table.specificType('version', 'smallint').defaultTo(0);
    table.string('old_id', 20); // Add old_id column to track migrated records - we will drop this with migration job

    table.timestamps(true, true);
  });

  // Step 3: Add indexes for better performance
  await knex.schema.alterTable(MetaTable.AUDIT, (table) => {
    table.primary(['id'], 'nc_audit_v2_pkx');
    table.index(['fk_workspace_id'], 'nc_audit_v2_fk_workspace_idx');
    table.index(['base_id', 'fk_workspace_id'], 'nc_audit_v2_tenant_idx');
    table.index(
      ['base_id', 'fk_model_id', 'row_id', 'fk_workspace_id'],
      'nc_record_audit_v2_tenant_idx',
    );
    table.index('old_id'); // Add index on old_id for faster lookups
  });
};

const down = async (_knex: Knex) => {
  throw new Error(
    'Down migration not implemented. Manual intervention required.',
  );
};

export { up, down };
