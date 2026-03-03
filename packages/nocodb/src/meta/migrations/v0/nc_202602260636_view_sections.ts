import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  const hasTable = await knex.schema.hasTable(MetaTable.VIEW_SECTIONS);
  if (!hasTable) {
    await knex.schema.createTable(MetaTable.VIEW_SECTIONS, (table) => {
      table.string('id', 20).primary().notNullable();

      table.string('fk_workspace_id', 20);
      table.string('base_id', 20);
      table.string('source_id', 20);
      table.string('fk_model_id', 20).notNullable();

      table.string('title', 255).notNullable();
      table.float('order');
      table.text('meta');

      table.string('created_by', 20);
      table.string('updated_by', 20);

      table.timestamps(true, true);

      table.index(['base_id', 'fk_workspace_id'], 'nc_view_sections_context');
      table.index('fk_model_id', 'nc_view_sections_model_idx');
    });
  }

  const hasColumn = await knex.schema.hasColumn(
    MetaTable.VIEWS,
    'fk_view_section_id',
  );
  if (!hasColumn) {
    await knex.schema.alterTable(MetaTable.VIEWS, (table) => {
      table.string('fk_view_section_id', 20).nullable();
    });
  }
};

const down = async (knex: Knex) => {
  await knex.schema.dropTableIfExists(MetaTable.VIEW_SECTIONS);

  const hasColumn = await knex.schema.hasColumn(
    MetaTable.VIEWS,
    'fk_view_section_id',
  );
  if (hasColumn) {
    await knex.schema.alterTable(MetaTable.VIEWS, (table) => {
      table.dropColumn('fk_view_section_id');
    });
  }
};

export { up, down };
