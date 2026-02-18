import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  if (!(await knex.schema.hasTable(MetaTable.TIMELINE_VIEW))) {
    await knex.schema.createTable(MetaTable.TIMELINE_VIEW, (table) => {
      table.string('fk_view_id', 20).notNullable();
      table.string('base_id', 20);
      table.string('source_id', 20);
      table.string('title', 255);
      table.text('meta');
      table.string('fk_workspace_id', 20);
      table.timestamps();
      table.primary(['base_id', 'fk_view_id']);
    });
  }

  if (!(await knex.schema.hasTable(MetaTable.TIMELINE_VIEW_COLUMNS))) {
    await knex.schema.createTable(MetaTable.TIMELINE_VIEW_COLUMNS, (table) => {
      table.string('id', 20).notNullable();
      table.string('base_id', 20);
      table.string('source_id', 20);
      table.string('fk_view_id', 20);
      table.string('fk_column_id', 20);
      table.boolean('show');
      table.boolean('bold');
      table.boolean('underline');
      table.boolean('italic');
      table.float('order');
      table.string('fk_workspace_id', 20);
      table.timestamps(true, true);
      table.primary(['base_id', 'id']);
    });
  }

  if (!(await knex.schema.hasTable(MetaTable.TIMELINE_VIEW_RANGE))) {
    await knex.schema.createTable(MetaTable.TIMELINE_VIEW_RANGE, (table) => {
      table.string('id', 20).notNullable();
      table.string('fk_view_id', 20);
      table.string('fk_from_column_id', 20);
      table.string('fk_to_column_id', 20);
      table.string('label', 40);
      table.string('base_id', 20);
      table.string('fk_workspace_id', 20);
      table.timestamps(true, true);
      table.primary(['base_id', 'id']);
    });
  }

  // Add indexes using raw SQL with IF NOT EXISTS (safe for PostgreSQL transactions)
  await knex.raw(
    `CREATE INDEX IF NOT EXISTS "nc_timeline_view_v2_base_id_fk_workspace_id_index" ON "${MetaTable.TIMELINE_VIEW}" ("base_id", "fk_workspace_id")`,
  );
  await knex.raw(
    `CREATE INDEX IF NOT EXISTS "nc_timeline_view_v2_oldpk_idx" ON "${MetaTable.TIMELINE_VIEW}" ("fk_view_id")`,
  );

  await knex.raw(
    `CREATE INDEX IF NOT EXISTS "nc_timeline_view_columns_v2_base_id_fk_workspace_id_index" ON "${MetaTable.TIMELINE_VIEW_COLUMNS}" ("base_id", "fk_workspace_id")`,
  );
  await knex.raw(
    `CREATE INDEX IF NOT EXISTS "nc_timeline_view_columns_v2_fk_view_id_fk_column_id_index" ON "${MetaTable.TIMELINE_VIEW_COLUMNS}" ("fk_view_id", "fk_column_id")`,
  );
  await knex.raw(
    `CREATE INDEX IF NOT EXISTS "nc_timeline_view_columns_v2_oldpk_idx" ON "${MetaTable.TIMELINE_VIEW_COLUMNS}" ("id")`,
  );

  await knex.raw(
    `CREATE INDEX IF NOT EXISTS "nc_timeline_view_range_v2_base_id_fk_workspace_id_index" ON "${MetaTable.TIMELINE_VIEW_RANGE}" ("base_id", "fk_workspace_id")`,
  );
  await knex.raw(
    `CREATE INDEX IF NOT EXISTS "nc_timeline_view_range_v2_oldpk_idx" ON "${MetaTable.TIMELINE_VIEW_RANGE}" ("id")`,
  );
};

const down = async (knex: Knex) => {
  await knex.schema.dropTableIfExists(MetaTable.TIMELINE_VIEW_RANGE);
  await knex.schema.dropTableIfExists(MetaTable.TIMELINE_VIEW_COLUMNS);
  await knex.schema.dropTableIfExists(MetaTable.TIMELINE_VIEW);
};

export { up, down };
