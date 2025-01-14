import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';
import { isEE } from '~/utils';

const up = async (knex: Knex) => {
  console.time('nc_074_missing_context_indexes');

  if (!isEE) {
    await knex.schema.alterTable(MetaTable.COL_BUTTON, (table) => {
      table.string('fk_workspace_id', 20);
    });
  }

  await knex.schema.alterTable(MetaTable.COL_BUTTON, (table) => {
    table.index('fk_column_id');
    table.index(['base_id', 'fk_workspace_id'], 'nc_col_button_context');
  });

  await knex.schema.alterTable(MetaTable.COL_LONG_TEXT, (table) => {
    table.index(['base_id', 'fk_workspace_id'], 'nc_col_long_text_context');
  });

  await knex.schema.alterTable(MetaTable.DATA_REFLECTION, (table) => {
    table.index('fk_workspace_id');
  });

  await knex.schema.alterTable(MetaTable.JOBS, (table) => {
    table.index(['base_id', 'fk_workspace_id'], 'nc_jobs_context');
  });

  await knex.schema.alterTable(MetaTable.USERS, (table) => {
    table.index('email');
  });

  console.timeEnd('nc_074_missing_context_indexes');
};

const down = async (knex) => {
  if (!isEE) {
    await knex.schema.alterTable(MetaTable.COL_BUTTON, (table) => {
      table.dropColumn('fk_workspace_id');
    });
  }

  await knex.schema.alterTable(MetaTable.COL_BUTTON, (table) => {
    table.dropIndex('fk_column_id');
    table.dropIndex(['base_id', 'fk_workspace_id'], 'nc_col_button_context');
  });

  await knex.schema.alterTable(MetaTable.COL_LONG_TEXT, (table) => {
    table.dropIndex(['base_id', 'fk_workspace_id'], 'nc_col_long_text_context');
  });

  await knex.schema.alterTable(MetaTable.DATA_REFLECTION, (table) => {
    table.dropIndex('fk_workspace_id');
  });

  await knex.schema.alterTable(MetaTable.JOBS, (table) => {
    table.dropIndex(['base_id', 'fk_workspace_id'], 'nc_jobs_context');
  });

  await knex.schema.alterTable(MetaTable.USERS, (table) => {
    table.dropIndex('email');
  });
};

export { up, down };
