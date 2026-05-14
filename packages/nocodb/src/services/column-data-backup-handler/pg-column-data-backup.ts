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
 * PostgreSQL implementation of the column-data backup primitives.
 *
 * Strategy:
 *   - `ALTER TABLE … ADD COLUMN <backup>` to create a sibling column on the
 *     source table. Type is derived from the source column's `dt` so the
 *     copy is a no-op cast.
 *   - `UPDATE … SET backup = original` to copy the data.
 *   - On restore: `UPDATE … SET dest = backup` then `DROP COLUMN backup`.
 *
 * Identifier quoting and schema qualification go through
 * `baseModelSqlV2.getTnPath` + knex `??` placeholders, mirroring the
 * formula-column-type-changer drivers.
 */
export class PgColumnDataBackup implements ColumnDataBackupDriver {
  dbDriverName = ClientType.PG;
  private readonly logger = new Logger(PgColumnDataBackup.name);

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
        .raw(`ALTER TABLE ?? ADD COLUMN IF NOT EXISTS ?? ${dt}`, [
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
      // PG `42703 undefined_column` — the backup column is already gone
      // (legacy stale ref, or a prior restore partially completed). Treat
      // as a no-op: the data we wanted to restore is unrecoverable, but
      // the caller's invariant (no live backup column with this name)
      // already holds. Any other error must surface so the orphan-cleanup
      // wrapper can drop the new backup and the row gets marked errored.
      if (e?.code !== '42703') throw e;
      this.logger.warn(
        `Backup column missing on restore — data unrecoverable. ` +
          `table=${baseModelSqlV2.model.table_name} backupCol=${backupRef.backupColumnName} ` +
          `destCol=${destinationColumn.column_name} sourceColId=${backupRef.sourceColumnId}`,
      );
    }

    await baseModelSqlV2.execAndParse(
      knex
        .raw(`ALTER TABLE ?? DROP COLUMN IF EXISTS ??`, [
          tnPath,
          backupRef.backupColumnName,
        ])
        .toQuery(),
      null,
      { raw: true },
    );
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

    // `IF EXISTS` makes this tolerant: if the source table or backup column
    // is already gone (e.g., table dropped before the cleanup processor ran), we skip
    // silently rather than erroring out.
    await baseModelSqlV2.execAndParse(
      knex
        .raw(`ALTER TABLE IF EXISTS ?? DROP COLUMN IF EXISTS ??`, [
          tnPath,
          backupRef.backupColumnName,
        ])
        .toQuery(),
      null,
      { raw: true },
    );
  }
}
