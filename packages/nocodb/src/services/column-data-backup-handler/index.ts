import type { BaseModelSqlv2 } from '~/db/BaseModelSqlv2';
import type { Column } from '~/models';

export function buildBackupColumnTypeExpr(
  sourceColumn: Column<any>,
  fallback: string,
): string {
  const dt = sourceColumn.dt || fallback;

  if (!/^[\w -]+(?:\(\d+(?:\s?,\s?\d+)?\))?$/.test(dt)) {
    throw new Error(`Invalid data type: ${dt}`);
  }

  // `dt` from introspection may already embed its parens (`varchar(255)`).
  if (/\(.*\)/.test(dt)) return dt;

  const dtxp = sourceColumn.dtxp;
  if (dtxp === undefined || dtxp === null || dtxp === '' || dtxp === ' ') {
    return dt;
  }

  if (
    /^(text|tinytext|mediumtext|longtext|blob|json|jsonb|uuid|bool|boolean)$/i.test(
      dt,
    )
  ) {
    return dt;
  }

  // dtxp can be numeric (`255`, `10,2`) or an enum/set value list
  // (`'a','b'`) — reject statement terminators / comment markers.
  const dtxpStr = String(dtxp);
  if (/[;\\]|--|\/\*|\*\//.test(dtxpStr)) {
    throw new Error(`Invalid data type precision: ${dtxpStr}`);
  }

  return `${dt}(${dtxpStr})`;
}

/**
 * Identifies a backup column belonging to a single source column. Persisted
 * verbatim onto the operation log row's `meta` JSONB so:
 *   - undo handlers can find the backup and restore from it
 *   - the cleanup processor can drop the backup column when the action expires
 *
 * For columns the backup is a sibling column on the same physical
 * table.
 */
export interface ColumnBackupRef {
  /** Name of the backup column on the same physical table. */
  backupColumnName: string;
  /** Source column id at backup time — for cleanup processor cross-checks. */
  sourceColumnId: string;
  /** Model id — restore/drop resolve the live `table_name` from this via
   *  `Model.get`, which transparently handles renames since backup time. */
  fkModelId: string;
}

/**
 * Per-DB-driver implementation of column-data backup primitives.
 * one impl per driver, registered by `dbDriverName` in the orchestrator service.
 *
 * All operations run native SQL (ALTER TABLE + UPDATE + DROP) — no row-by-row
 * cell serialization. Trades portability for speed; that's the same trade
 */
export interface ColumnDataBackupDriver {
  dbDriverName: string;

  /**
   * Create a sibling backup column on the source column's table and copy the
   * source column's data into it. Caller controls the identifier so it can
   * be derived from the operation id + a uuid
   *
   * Returns a ref the caller persists onto the operation log so undo +
   * cleanup processor can find the backup later.
   */
  backupColumnData(param: {
    baseModelSqlV2: BaseModelSqlv2;
    sourceColumn: Column<any>;
    /** Pre-computed backup column name. Caller owns naming + collision policy. */
    identifier: string;
  }): Promise<ColumnBackupRef>;

  /**
   * Copy data from a previously-created backup column into the destination
   * column, then drop the backup column. The destination column must already
   * exist with a compatible type — caller is responsible for running the
   * ALTER TABLE that converts type before invoking this.
   */
  restoreBackupData(param: {
    baseModelSqlV2: BaseModelSqlv2;
    destinationColumn: Column<any>;
    backupRef: ColumnBackupRef;
  }): Promise<void>;

  /**
   * Drop a backup column without restoring. Used by the cleanup processor to reclaim
   * disk when an operation log row expires past the undo window.
   *
   * Tolerates missing tables/columns: if the backup is already gone (e.g.,
   * the source table was dropped), the call is a no-op.
   */
  dropBackup(param: {
    baseModelSqlV2: BaseModelSqlv2;
    backupRef: ColumnBackupRef;
  }): Promise<void>;
}
