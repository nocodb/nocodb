import type { Knex } from 'knex';
import { Logger } from '@nestjs/common';
import { MetaTable } from '~/utils/globals';

const logger = new Logger('nc_202606290001_cleanup_orphan_view_columns');

/**
 * Delete orphaned view-column rows whose `fk_column_id` no longer points to an
 * existing `nc_columns` row.
 *
 * Such orphans are left behind by code paths that remove a column via raw
 * `metaDelete` instead of the cascading `Column.delete` — e.g. the Links V1→V2
 * upgrade's FK-column removal (#14166) and the cross-base link-placeholder
 * rollback. They surface as repeated "Column not found for viewOrTableColumn"
 * warnings (BaseModelSqlv2) and phantom columns in views.
 *
 * Source-agnostic, one-time cleanup: removes the dangling rows regardless of
 * which path created them. Column ids are globally unique nanoids, so a
 * `fk_column_id` that matches no `nc_columns` row anywhere is genuinely orphaned
 * (cross-base links still reference a LOCAL column that exists in `nc_columns`).
 */
const VIEW_COLUMN_TABLES = [
  MetaTable.GRID_VIEW_COLUMNS,
  MetaTable.FORM_VIEW_COLUMNS,
  MetaTable.KANBAN_VIEW_COLUMNS,
  MetaTable.GALLERY_VIEW_COLUMNS,
  MetaTable.CALENDAR_VIEW_COLUMNS,
  MetaTable.MAP_VIEW_COLUMNS,
];

const up = async (knex: Knex) => {
  let total = 0;

  for (const table of VIEW_COLUMN_TABLES) {
    const deleted = await knex(table)
      .whereNotNull('fk_column_id')
      .whereNotExists(function () {
        this.select(knex.raw('1'))
          .from(MetaTable.COLUMNS)
          .whereRaw(`${MetaTable.COLUMNS}.id = ${table}.fk_column_id`);
      })
      .delete();

    if (deleted) {
      logger.log(`Removed ${deleted} orphaned row(s) from ${table}`);
      total += Number(deleted);
    }
  }

  logger.log(`Orphan view-column cleanup complete: ${total} row(s) removed.`);
};

const down = async (_knex: Knex) => {
  // Not reversible — the deleted rows referenced columns that no longer exist.
};

export { up, down };
