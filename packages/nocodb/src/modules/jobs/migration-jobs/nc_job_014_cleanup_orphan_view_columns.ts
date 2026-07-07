import { Injectable, Logger } from '@nestjs/common';
import debug from 'debug';
import { MetaTable } from '~/utils/globals';
import Noco from '~/Noco';

/**
 * One-time cleanup of orphaned view-column rows whose `fk_column_id` no longer
 * points to an existing `nc_columns` row.
 *
 * Such orphans are left behind by code paths that remove a column via raw
 * `metaDelete` instead of the cascading `Column.delete` — e.g. the Links V1→V2
 * upgrade's FK-column removal (#14166) and the cross-base link-placeholder
 * rollback. They surface as repeated "Column not found for viewOrTableColumn"
 * warnings (BaseModelSqlv2) and phantom columns in views.
 *
 * Runs as a background migration job (non-blocking) rather than a boot-time
 * knex migration: on large instances the anti-join over the view-column tables
 * can take a while, and it must not delay startup.
 *
 * Source-agnostic, one-time cleanup: removes dangling rows regardless of which
 * path created them. Column ids are globally unique nanoids, so a `fk_column_id`
 * that matches no `nc_columns` row anywhere is genuinely orphaned (cross-base
 * links still reference a LOCAL column that exists in `nc_columns`).
 *
 * Idempotent — a re-run finds zero orphans. Best-effort per table: a failure is
 * logged and skipped, never aborting the whole job.
 */
const VIEW_COLUMN_TABLES = [
  MetaTable.GRID_VIEW_COLUMNS,
  MetaTable.FORM_VIEW_COLUMNS,
  MetaTable.KANBAN_VIEW_COLUMNS,
  MetaTable.GALLERY_VIEW_COLUMNS,
  MetaTable.CALENDAR_VIEW_COLUMNS,
  MetaTable.MAP_VIEW_COLUMNS,
];

@Injectable()
export class CleanupOrphanViewColumnsMigration {
  private readonly debugLog = debug(
    'nc:migration-jobs:cleanup-orphan-view-columns',
  );
  private readonly logger = new Logger(
    CleanupOrphanViewColumnsMigration.name,
  );

  async job() {
    const knex = Noco.ncMeta.knexConnection;

    let total = 0;

    // Pure-knex anti-join delete per table so it runs on any meta DB. Table
    // names come from the MetaTable enum (constants), not user input.
    for (const table of VIEW_COLUMN_TABLES) {
      try {
        const deleted = await knex(table)
          .whereNotNull('fk_column_id')
          .whereNotExists(function () {
            this.select(knex.raw('1'))
              .from(MetaTable.COLUMNS)
              .whereRaw(`${MetaTable.COLUMNS}.id = ${table}.fk_column_id`);
          })
          .delete();

        if (deleted) {
          this.logger.log(`Removed ${deleted} orphaned row(s) from ${table}`);
          this.debugLog(`removed ${deleted} from ${table}`);
          total += Number(deleted);
        }
      } catch (e) {
        this.logger.warn(
          `Orphan view-column cleanup skipped ${table}: ${e?.message}`,
          e?.stack,
        );
      }
    }

    this.logger.log(
      `Orphan view-column cleanup complete: ${total} row(s) removed.`,
    );

    return true;
  }
}
