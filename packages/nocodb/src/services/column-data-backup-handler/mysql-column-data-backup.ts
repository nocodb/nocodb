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
 * MySQL/MariaDB implementation. Differs from PG in two places:
 *   - MySQL doesn't support `ADD COLUMN IF NOT EXISTS` consistently across
 *     versions before 8.0.29. We use the unconditional form and let it error
 *     loudly if the identifier collides — the caller picks unique names via
 *     the per-action nanoid.
 *   - `DROP COLUMN IF EXISTS` is supported on 8.0+ but missing on MariaDB
 *     <10.5. We swallow the column-not-found error in `dropBackup` for the
 *     cleanup processor's tolerance contract.
 */
export class MysqlColumnDataBackup implements ColumnDataBackupDriver {
  dbDriverName = ClientType.MYSQL;
  private readonly logger = new Logger(MysqlColumnDataBackup.name);

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
    const dt = buildBackupColumnTypeExpr(sourceColumn, 'text');

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
      // MySQL `1054 ER_BAD_FIELD_ERROR` — backup column already gone.
      // Treat as no-op: data is unrecoverable but the post-condition (no
      // live backup column with this name) already holds. Anything else
      // surfaces so the orphan-cleanup wrapper can drop the new backup
      // and the row gets marked errored.
      const code = err?.code || err?.errno;
      const msg = String(err?.message || '');
      const isMissing =
        code === 'ER_BAD_FIELD_ERROR' ||
        code === 1054 ||
        /unknown column/i.test(msg);
      if (!isMissing) throw err;
      this.logger.warn(
        `Backup column missing on restore — data unrecoverable. ` +
          `table=${baseModelSqlV2.model.table_name} backupCol=${backupRef.backupColumnName} ` +
          `destCol=${destinationColumn.column_name} sourceColId=${backupRef.sourceColumnId}`,
      );
    }

    // DROP is best-effort: idempotent via the same swallow as `dropBackup`.
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
      const code = err?.code || err?.errno;
      const msg = String(err?.message || '');
      const isMissing =
        code === 'ER_CANT_DROP_FIELD_OR_KEY' ||
        code === 1091 ||
        /doesn't exist|check that column.*exists/i.test(msg);
      if (!isMissing) throw err;
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

    // Older MariaDB lacks `DROP COLUMN IF EXISTS`. Try the bare DROP and
    // swallow MySQL error 1091 (Can't DROP — column doesn't exist) so the
    // cleanup processor stays idempotent.
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
      const code = err?.code || err?.errno;
      const msg = String(err?.message || '');
      const isMissing =
        code === 'ER_CANT_DROP_FIELD_OR_KEY' ||
        code === 1091 ||
        /doesn't exist|check that column.*exists/i.test(msg);
      if (!isMissing) throw err;
    }
  }
}
