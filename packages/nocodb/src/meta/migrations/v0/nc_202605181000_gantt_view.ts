import type { Knex } from 'knex';
import { MetaTable } from '~/utils/globals';

const up = async (knex: Knex) => {
  await knex.schema.createTable(MetaTable.GANTT_VIEW, (table) => {
    table.string('fk_view_id', 20).notNullable();
    table.string('base_id', 20);
    table.string('source_id', 20);
    table.string('title', 255);
    table.text('meta');
    table.string('fk_workspace_id', 20);
    table.timestamps(true, true);
    table.primary(['base_id', 'fk_view_id']);
    table.index(
      ['base_id', 'fk_workspace_id'],
      'nc_gantt_view_v2_base_id_fk_workspace_id_index',
    );
    table.index(['fk_view_id'], 'nc_gantt_view_v2_oldpk_idx');
  });

  await knex.schema.createTable(MetaTable.GANTT_VIEW_COLUMNS, (table) => {
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
    table.boolean('group_by');
    table.float('group_by_order');
    table.string('group_by_sort', 4);
    table.string('aggregation', 20);
    table.string('fk_workspace_id', 20);
    table.timestamps(true, true);
    table.primary(['base_id', 'id']);
    table.index(
      ['base_id', 'fk_workspace_id'],
      'nc_gantt_view_columns_v2_base_id_fk_workspace_id_index',
    );
    table.index(
      ['fk_view_id', 'fk_column_id'],
      'nc_gantt_view_columns_v2_fk_view_id_fk_column_id_index',
    );
    table.index(['id'], 'nc_gantt_view_columns_v2_oldpk_idx');
  });

  // Date-dependency rules are stored per (table, gantt view) — many rules per
  // table allowed, each Gantt view owns its own rule. A rule with
  // fk_gantt_view_id IS NULL is the "default" / table-level rule used by grid
  // edits (and by the original single-rule API). Existing call sites that
  // looked up DateDependency.getByModelId continue to receive that default.
  //
  // The UNIQUE constraint on fk_gantt_view_id enforces the 1:1 contract the
  // model layer assumes (DateDependency.getByGanttViewId uses metaGet2 and
  // returns a single row). A retried request, idempotent sandbox replay, or
  // concurrent POST cannot persist a duplicate. All three target DBs
  // (Postgres, SQLite, MySQL) treat multiple NULLs as distinct under UNIQUE,
  // so the table-level default rule (one per table, fk_gantt_view_id IS NULL)
  // is unaffected.
  await knex.schema.alterTable(MetaTable.DATE_DEPENDENCY, (table) => {
    table.string('fk_gantt_view_id', 20).nullable();
    table.index(
      ['fk_model_id', 'fk_gantt_view_id'],
      'nc_date_dep_model_view_idx',
    );
    table.unique(['fk_gantt_view_id'], 'nc_date_dep_gantt_view_id_unique');
  });
};

const down = async (knex: Knex) => {
  await knex.schema.alterTable(MetaTable.DATE_DEPENDENCY, (table) => {
    table.dropUnique(['fk_gantt_view_id'], 'nc_date_dep_gantt_view_id_unique');
    table.dropIndex(
      ['fk_model_id', 'fk_gantt_view_id'],
      'nc_date_dep_model_view_idx',
    );
    table.dropColumn('fk_gantt_view_id');
  });
  await knex.schema.dropTableIfExists(MetaTable.GANTT_VIEW_COLUMNS);
  await knex.schema.dropTableIfExists(MetaTable.GANTT_VIEW);
};

export { up, down };
