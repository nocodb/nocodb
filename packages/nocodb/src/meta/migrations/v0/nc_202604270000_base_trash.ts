import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  // Add `error` column to col option tables (lookup, rollup, qrcode, barcode)
  const colOptionTables = [
    MetaTable.COL_LOOKUP,
    MetaTable.COL_ROLLUP,
    MetaTable.COL_QRCODE,
    MetaTable.COL_BARCODE,
  ];

  for (const table of colOptionTables) {
    await knex.schema.alterTable(table, (t) => {
      t.text('error');
    });
  }

  await knex.schema.createTable(MetaTable.TRASH, (table) => {
    table.string('id', 20);

    table.string('name', 255);
    table.string('parent_name', 255);

    table.string('resource_type');
    table.string('resource_id', 255);

    table.string('parent_type');
    table.string('parent_id', 20);

    table.string('deleted_by', 20);
    table.timestamp('deleted_at');
    table.timestamp('cleanup_due_at');

    table.text('related_items');
    table.text('meta');
    table.timestamps(true, true);

    table.string('fk_workspace_id', 20);
    table.string('base_id', 20);

    table.primary(['base_id', 'id']);
    table.unique(['base_id', 'resource_type', 'resource_id']);
    table.index(['base_id', 'fk_workspace_id']);
    table.index(['cleanup_due_at']);
  });

  // Add `deleted` column where missing
  const tables = [
    MetaTable.MODELS,
    MetaTable.COLUMNS,
    MetaTable.VIEWS,
    MetaTable.AUTOMATIONS,
    MetaTable.DASHBOARDS,
    MetaTable.WIDGETS,
    MetaTable.EXTENSIONS,
    MetaTable.HOOKS,
  ];

  for (const table of tables) {
    const hasDeleted = await knex.schema.hasColumn(table, 'deleted');
    if (!hasDeleted) {
      await knex.schema.alterTable(table, (t) => {
        t.boolean('deleted');
      });
    }
  }

  if (await knex.schema.hasColumn(MetaTable.MODELS, 'trash_cleanup_due_at')) {
    await knex.schema.alterTable(MetaTable.MODELS, (table) => {
      table.dropIndex(
        'trash_cleanup_due_at',
        'idx_nc_models_trash_cleanup_due_at',
      );
      table.dropColumn('trash_cleanup_due_at');
    });
  }
};

const down = async (knex: Knex) => {
  // Drop `error` column from col option tables
  const colOptionTables = [
    MetaTable.COL_LOOKUP,
    MetaTable.COL_ROLLUP,
    MetaTable.COL_QRCODE,
    MetaTable.COL_BARCODE,
  ];

  for (const table of colOptionTables) {
    await knex.schema.alterTable(table, (t) => {
      t.dropColumn('error');
    });
  }

  await knex.schema.dropTableIfExists(MetaTable.TRASH);

  if (
    !(await knex.schema.hasColumn(MetaTable.MODELS, 'trash_cleanup_due_at'))
  ) {
    await knex.schema.alterTable(MetaTable.MODELS, (table) => {
      table.timestamp('trash_cleanup_due_at').defaultTo(null);
      table.index('trash_cleanup_due_at', 'idx_nc_models_trash_cleanup_due_at');
    });
  }

  // Only drop columns we added (views, automations, dashboards, widgets)
  // models and columns already had `deleted` before this migration
  const tablesWeAdded = [
    MetaTable.VIEWS,
    MetaTable.AUTOMATIONS,
    MetaTable.DASHBOARDS,
    MetaTable.WIDGETS,
    MetaTable.EXTENSIONS,
    MetaTable.HOOKS,
  ];

  for (const table of tablesWeAdded) {
    const hasDeleted = await knex.schema.hasColumn(table, 'deleted');
    if (hasDeleted) {
      await knex.schema.alterTable(table, (t) => {
        t.dropColumn('deleted');
      });
    }
  }
};

export { up, down };
