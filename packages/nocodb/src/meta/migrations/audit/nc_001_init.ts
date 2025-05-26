import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.createTable(MetaTable.AUDIT, (table) => {
    if (knex.client.config.client === 'pg') {
      table.uuid('id').primary();
    } else {
      table.string('id', 36).primary();
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
    table.string('fk_parent_id', 20);
    table.string('fk_workspace_id', 20);
    table.string('fk_org_id', 20);
    table.text('user_agent');
    table.specificType('version', 'smallint').defaultTo(0);

    table.timestamps(true, true);
  });

  await knex.schema.createTable(MetaTable.RECORD_AUDIT, (table) => {
    if (knex.client.config.client === 'pg') {
      table.uuid('id').primary();
    } else {
      table.string('id', 36).primary();
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
    table.string('fk_parent_id', 20);
    table.string('fk_workspace_id', 20);
    table.string('fk_org_id', 20); // new column
    table.text('user_agent');
    table.specificType('version', 'smallint').defaultTo(0);

    table.timestamps(true, true);
  });

  await knex.schema.alterTable(MetaTable.AUDIT, (table) => {
    table.index(['base_id', 'fk_workspace_id'], 'nc_audit_v2_context');
  });

  await knex.schema.alterTable(MetaTable.RECORD_AUDIT, (table) => {
    table.index(['base_id', 'fk_workspace_id'], 'nc_record_audit_v2_context');
    table.index(['fk_model_id', 'row_id'], 'nc_record_audit_v2_data_index');
  });
};

const down = async (knex: Knex) => {
  await knex.schema.dropTable(MetaTable.AUDIT);
};

export { up, down };
