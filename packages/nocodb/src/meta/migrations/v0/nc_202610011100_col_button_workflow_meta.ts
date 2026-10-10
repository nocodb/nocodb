import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.COL_BUTTON, (table) => {
    table.string('fk_workflow_id', 20);
    table.text('action_config');
  });
  await knex.schema.alterTable(MetaTable.COL_BUTTON, (table) => {
    table.index(['fk_workflow_id'], 'nc_col_button_v2_fk_workflow_id_index');
  });
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.COL_BUTTON, (table) => {
    table.dropIndex(
      ['fk_workflow_id'],
      'nc_col_button_v2_fk_workflow_id_index',
    );
  });
  await knex.schema.alterTable(MetaTable.COL_BUTTON, (table) => {
    table.dropColumn('fk_workflow_id');
    table.dropColumn('action_config');
  });
};

export { up, down };
