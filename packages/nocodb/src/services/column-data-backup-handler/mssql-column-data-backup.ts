import { Logger } from '@nestjs/common';
import { ClientType } from 'nocodb-sdk';
import type {
  ColumnBackupRef,
  ColumnDataBackupDriver,
} from '~/services/column-data-backup-handler';
import type { BaseModelSqlv2 } from '~/db/BaseModelSqlv2';
import type { Column } from '~/models';
import { buildBackupColumnTypeExpr } from '~/services/column-data-backup-handler';

// SQL Server "Invalid column name" — raised when the restore UPDATE references
// a backup column that's already gone (stale ref / partial prior restore).
const MSSQL_INVALID_COLUMN = 207;

/**
 * SQL Server (T-SQL) implementation of the column-data backup primitives.
 *
 * Same strategy as the pg/mysql drivers — sibling backup column + native
 * UPDATE copy — with two T-SQL adjustments:
 *   - `ALTER TABLE … ADD <col> <type>` (no `COLUMN` keyword, and T-SQL has no
 *     `ADD COLUMN IF NOT EXISTS`), `… DROP COLUMN <col>` for removal.
 *   - Idempotency is gated with `COL_LENGTH('schema.table','col')`, which is
 *     NULL when the column (or table) is absent. This works on every SQL
 *     Server version, unlike `DROP COLUMN IF EXISTS` (2016+ only), and lets
 *     `dropBackup` tolerate a dropped source table without a separate guard.
 *
 * `getTnPath` returns the raw `schema.table` form: passed as a `??` binding it
 * quotes to `[schema].[table]`; passed as a `?` binding it inlines as the
 * `'schema.table'` string `COL_LENGTH` expects.
 */
export class MssqlColumnDataBackup implements ColumnDataBackupDriver {
  dbDriverName = ClientType.MSSQL;
  private readonly logger = new Logger(MssqlColumnDataBackup.name);

  async backupColumnData({
    baseModelSqlV2,
    sourceColumn,
    identifier,
  }: {
    baseModelSqlV2: BaseModelSqlv2;
    sourceColumn: Column<any>;
    identifier: string;
  }): Promise<ColumnBackupRef> {
    const knex = baseModelSqlV2.dbDriver;
    const tnPath = baseModelSqlV2.getTnPath(baseModelSqlV2.model.table_name);

    // Backup column mirrors the source column's type so the copy is a no-op
    // cast. NocoDB MSSQL text columns are `nvarchar(MAX)` — use that as the
    // fallback when `dt` is somehow missing.
    const dt = buildBackupColumnTypeExpr(sourceColumn, 'nvarchar(max)');

    await baseModelSqlV2.execAndParse(
      knex
        .raw(`IF COL_LENGTH(?, ?) IS NULL ALTER TABLE ?? ADD ?? ${dt}`, [
          tnPath,
          identifier,
          tnPath,
          identifier,
        ])
        .toQuery(),
      null,
      { raw: true },
    );

    await baseModelSqlV2.execAndParse(
      knex
        .raw(`UPDATE ?? SET ?? = ??`, [
          tnPath,
          identifier,
          sourceColumn.column_name,
        ])
        .toQuery(),
      null,
      { raw: true },
    );

    return {
      backupColumnName: identifier,
      sourceColumnId: sourceColumn.id,
      fkModelId: sourceColumn.fk_model_id,
    };
  }

  async restoreBackupData({
    baseModelSqlV2,
    destinationColumn,
    backupRef,
  }: {
    baseModelSqlV2: BaseModelSqlv2;
    destinationColumn: Column<any>;
    backupRef: ColumnBackupRef;
  }): Promise<void> {
    const knex = baseModelSqlV2.dbDriver;
    const tnPath = baseModelSqlV2.getTnPath(baseModelSqlV2.model.table_name);

    try {
      await baseModelSqlV2.execAndParse(
        knex
          .raw(`UPDATE ?? SET ?? = ??`, [
            tnPath,
            destinationColumn.column_name,
            backupRef.backupColumnName,
          ])
          .toQuery(),
        null,
        { raw: true },
      );
    } catch (e: any) {
      // Backup column already gone — treat as a no-op (data unrecoverable, but
      // the caller's invariant already holds). Mirrors the pg driver's `42703`
      // handling. Any other error must surface so the orphan-cleanup wrapper
      // can drop the new backup and mark the row errored.
      const isMissingColumn =
        e?.number === MSSQL_INVALID_COLUMN ||
        e?.originalError?.number === MSSQL_INVALID_COLUMN ||
        /invalid column name/i.test(e?.message ?? '');
      if (!isMissingColumn) throw e;
      this.logger.warn(
        `Backup column missing on restore — data unrecoverable. ` +
          `table=${baseModelSqlV2.model.table_name} backupCol=${backupRef.backupColumnName} ` +
          `destCol=${destinationColumn.column_name} sourceColId=${backupRef.sourceColumnId}`,
      );
    }

    await this._dropColumnIfExists(
      baseModelSqlV2,
      tnPath,
      backupRef.backupColumnName,
    );
  }

  async dropBackup({
    baseModelSqlV2,
    backupRef,
  }: {
    baseModelSqlV2: BaseModelSqlv2;
    backupRef: ColumnBackupRef;
  }): Promise<void> {
    const tnPath = baseModelSqlV2.getTnPath(baseModelSqlV2.model.table_name);
    await this._dropColumnIfExists(
      baseModelSqlV2,
      tnPath,
      backupRef.backupColumnName,
    );
  }

  private async _dropColumnIfExists(
    baseModelSqlV2: BaseModelSqlv2,
    tnPath: string,
    columnName: string,
  ): Promise<void> {
    const knex = baseModelSqlV2.dbDriver;
    // COL_LENGTH is NULL when the column OR the table is absent, so this is
    // tolerant of a dropped source table — no separate OBJECT_ID guard needed.
    await baseModelSqlV2.execAndParse(
      knex
        .raw(`IF COL_LENGTH(?, ?) IS NOT NULL ALTER TABLE ?? DROP COLUMN ??`, [
          tnPath,
          columnName,
          tnPath,
          columnName,
        ])
        .toQuery(),
      null,
      { raw: true },
    );
  }
}
