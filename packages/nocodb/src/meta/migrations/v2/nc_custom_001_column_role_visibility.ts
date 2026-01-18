import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.createTable(MetaTable.COLUMN_ROLE_VISIBILITY, (table) => {
    table.string('id', 20).primary().notNullable();

    table.string('fk_workspace_id', 20);
    table.string('base_id', 20);

    table.string('source_id', 20);

    table.string('fk_column_id', 20);
    table.foreign('fk_column_id').references(`${MetaTable.COLUMNS}.id`);

    table.string('role', 45);
    table.boolean('disabled').defaultTo(false);
    table.timestamps(true, true);

    table.index(
      ['base_id', 'fk_workspace_id'],
      'nc_column_role_visibility_context',
    );
    table.index(
      ['fk_column_id', 'role'],
      'nc_column_role_visibility_column_role',
    );
  });
};

const down = async (knex: Knex) => {
  await knex.schema.dropTable(MetaTable.COLUMN_ROLE_VISIBILITY);
};

export { up, down };
