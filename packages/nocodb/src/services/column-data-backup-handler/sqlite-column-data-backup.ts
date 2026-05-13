import { Logger } from '@nestjs/common';
import { ClientType } from 'nocodb-sdk';
import type {
  ColumnBackupRef,
  ColumnDataBackupDriver,
} from '~/services/column-data-backup-handler';
import type { BaseModelSqlv2 } from '~/db/BaseModelSqlv2';
import type { Column } from '~/models';
import { buildBackupColumnTypeExpr } from '~/services/column-data-backup-handler';

/**
 * SQLite implementation.
 */
export class SqliteColumnDataBackup implements ColumnDataBackupDriver {
  dbDriverName = ClientType.SQLITE;
  private readonly logger = new Logger(SqliteColumnDataBackup.name);

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
    const dt = buildBackupColumnTypeExpr(sourceColumn, 'TEXT');

    await baseModelSqlV2.execAndParse(
      knex
        .raw(`ALTER TABLE ?? ADD COLUMN ?? ${dt}`, [tnPath, identifier])
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
    } catch (err: any) {
      // SQLite "no such column" — backup column already gone. Treat as
      // no-op: data is unrecoverable but the post-condition (no live
      // backup column with this name) already holds. Anything else
      // surfaces so the orphan-cleanup wrapper can drop the new backup.
      const msg = String(err?.message || '');
      if (!/no such (column|table)/i.test(msg)) throw err;
      this.logger.warn(
        `Backup column missing on restore — data unrecoverable. ` +
          `table=${baseModelSqlV2.model.table_name} backupCol=${backupRef.backupColumnName} ` +
          `destCol=${destinationColumn.column_name} sourceColId=${backupRef.sourceColumnId}`,
      );
    }

    try {
      await baseModelSqlV2.execAndParse(
        knex
          .raw(`ALTER TABLE ?? DROP COLUMN ??`, [
            tnPath,
            backupRef.backupColumnName,
          ])
          .toQuery(),
        null,
        { raw: true },
      );
    } catch (err: any) {
      const msg = String(err?.message || '');
      if (!/no such (column|table)/i.test(msg)) throw err;
    }
  }

  async dropBackup({
    baseModelSqlV2,
    backupRef,
  }: {
    baseModelSqlV2: BaseModelSqlv2;
    backupRef: ColumnBackupRef;
  }): Promise<void> {
    const knex = baseModelSqlV2.dbDriver;
    const tnPath = baseModelSqlV2.getTnPath(baseModelSqlV2.model.table_name);

    // Idempotent: swallow "no such column" so the cleanup processor doesn't fail when
    // the source table or column was dropped between forward and sweep.
    try {
      await baseModelSqlV2.execAndParse(
        knex
          .raw(`ALTER TABLE ?? DROP COLUMN ??`, [
            tnPath,
            backupRef.backupColumnName,
          ])
          .toQuery(),
        null,
        { raw: true },
      );
    } catch (err: any) {
      const msg = String(err?.message || '');
      if (!/no such (column|table)/i.test(msg)) throw err;
    }
  }
}
