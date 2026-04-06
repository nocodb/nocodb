import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.createTable(MetaTable.BASE_VARIABLES, (table) => {
    table.string('id', 20).notNullable();
    table.string('base_id', 20);
    table.string('fk_workspace_id', 20);
    table.string('key', 255);
    table.text('value');
    table.text('description');
    table.string('mode', 20).defaultTo('required');
    table.string('type', 20).defaultTo('string');
    table.boolean('is_sensitive').defaultTo(false);
    table.float('order');
    table.timestamps(true, true);
    table.primary(['base_id', 'id']);
  });

  await knex.schema.alterTable(MetaTable.BASE_VARIABLES, (table) => {
    table.unique(
      ['fk_workspace_id', 'base_id', 'key'],
      'nc_base_variables_ws_base_key_unique',
    );
    table.index(
      ['base_id', 'fk_workspace_id'],
      'nc_base_variables_base_ws_index',
    );
  });
};

const down = async (knex: Knex) => {
  await knex.schema.dropTableIfExists(MetaTable.BASE_VARIABLES);
};

export { up, down };
