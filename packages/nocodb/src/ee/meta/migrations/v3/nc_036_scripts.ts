import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.createTable(MetaTable.SCRIPTS, (table) => {
    table.string('id', 20).primary();
    table.text('title');
    table.text('description');
    table.text('meta');
    table.float('order');

    table.string('base_id', 20);
    table.string('fk_workspace_id', 20);

    table.text('code');
    table.text('config');

    table.string('created_by', 20);
    table.timestamps(true, true);

    table.index(['base_id', 'fk_workspace_id'], 'nc_scripts_context');
  });

  await knex.schema.alterTable(MetaTable.COL_BUTTON, (table) => {
    table.string('fk_script_id', 20);
  });
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.SCRIPTS, (table) => {
    table.dropIndex(['base_id', 'fk_workspace_id'], 'nc_scripts_context');
  });
  await knex.schema.dropTableIfExists(MetaTable.SCRIPTS);

  await knex.schema.alterTable(MetaTable.COL_BUTTON, (table) => {
    table.dropColumn('fk_script_id');
  });
};

export { up, down };
