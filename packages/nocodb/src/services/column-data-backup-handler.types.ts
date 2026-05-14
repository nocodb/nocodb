import type { NcContext } from 'nocodb-sdk';
import type { ColumnBackupRef } from '~/services/column-data-backup-handler';
import type { Column } from '~/models';

/**
 * Public API of the column-data backup orchestrator. Owns:
 *   - driver selection (PG / MySQL / SQLite) by the column's source dialect
 *   - backup column naming (per the agreed convention:
 *     `<column_name>_<column_id>_backup_<short_nano>[_undo]`)
 *   - tolerance: missing tables / dropped columns / schema drift
 *
 */
export interface IColumnDataBackupHandler {
  /**
   * Snapshot the source column's data into a sibling backup column. Returns
   * a ref the caller persists (e.g., onto `nc_operation_logs.meta`)
   * so undo/redo handlers and the cleanup job can find the backup later.
   */
  backup(
    context: NcContext,
    param: {
      sourceColumn: Column<any>;
      backupUid: string;
      forUndo?: boolean;
    },
  ): Promise<ColumnBackupRef>;

  /**
   * Copy data from a previously-backed-up column into the destination column,
   * then drop the backup column. Caller is responsible for ensuring the
   * destination column has a compatible type (the ALTER TABLE happens
   * outside this handler).
   */
  restore(
    context: NcContext,
    param: {
      destinationColumn: Column<any>;
      backupRef: ColumnBackupRef;
    },
  ): Promise<void>;

  /**
   * Drop the backup column without restoring. Used by the cleanup job when an
   * operation log row expires past the undo window. Tolerates missing
   * source table / column.
   */
  drop(
    context: NcContext,
    param: { backupRef: ColumnBackupRef },
  ): Promise<void>;
}
