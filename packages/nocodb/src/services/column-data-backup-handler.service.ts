import { Injectable, Logger } from '@nestjs/common';
import { type NcContext } from 'nocodb-sdk';
import { customAlphabet } from 'nanoid';
import type { IColumnDataBackupHandler } from './column-data-backup-handler.types';
import type {
  ColumnBackupRef,
  ColumnDataBackupDriver,
} from '~/services/column-data-backup-handler';
import type { Column } from '~/models';
import { Model } from '~/models';
import { getBaseModelSqlFromModelId } from '~/helpers/dbHelpers';
import { NcError } from '~/helpers/ncError';
import { MssqlColumnDataBackup } from '~/services/column-data-backup-handler/mssql-column-data-backup';
import { MysqlColumnDataBackup } from '~/services/column-data-backup-handler/mysql-column-data-backup';
import { PgColumnDataBackup } from '~/services/column-data-backup-handler/pg-column-data-backup';
import { SqliteColumnDataBackup } from '~/services/column-data-backup-handler/sqlite-column-data-backup';

const COLUMN_NAME_MAX_LEN = 28;
const SHORT_NANO = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 6);

@Injectable()
export class ColumnDataBackupHandler implements IColumnDataBackupHandler {
  private readonly logger = new Logger(ColumnDataBackupHandler.name);

  private readonly drivers: Record<string, ColumnDataBackupDriver> = {};

  constructor() {
    const pg = new PgColumnDataBackup();
    const mysql = new MysqlColumnDataBackup();
    const sqlite = new SqliteColumnDataBackup();
    const mssql = new MssqlColumnDataBackup();

    this.drivers[pg.dbDriverName] = pg;
    this.drivers['postgre'] = pg;
    this.drivers['postgres'] = pg;

    this.drivers[mysql.dbDriverName] = mysql;
    this.drivers['mysql2'] = mysql;
    this.drivers['mariadb'] = mysql;

    this.drivers[sqlite.dbDriverName] = sqlite;
    this.drivers['sqlite3'] = sqlite;

    this.drivers[mssql.dbDriverName] = mssql;
  }

  /**
   * Build a backup column identifier per the agreed convention:
   *   `<column_name>_<column_id>_backup_<6_nano>[_undo]`
   *
   * `column_name` is truncated to `COLUMN_NAME_MAX_LEN` to keep the total
   * under PG/MySQL identifier length limits. The column id makes collisions
   * impossible across columns; the nanoid disambiguates concurrent
   * forward/undo passes on the same action.
   */
  static buildIdentifier(param: {
    column: Column<any>;
    backupUid: string;
    forUndo?: boolean;
  }): string {
    const safeColName = (
      param.column.column_name ||
      param.column.title ||
      'col'
    )
      .replace(/[^a-zA-Z0-9_]/g, '_')
      .slice(0, COLUMN_NAME_MAX_LEN);

    const suffix = param.forUndo ? '_undo' : '';
    return `${safeColName}_${param.column.id}_backup_${param.backupUid}${suffix}`;
  }

  /** Allocate a fresh backup uid for a new action. */
  static newBackupUid(): string {
    return SHORT_NANO();
  }

  private async resolveDriver(
    context: NcContext,
    column: Column<any>,
  ): Promise<{
    driver: ColumnDataBackupDriver;
    baseModelSqlV2: any;
  }> {
    const baseModelSqlV2 = await getBaseModelSqlFromModelId({
      context,
      modelId: column.fk_model_id,
    });
    const clientType = baseModelSqlV2.dbDriver.clientType();
    const driver = this.drivers[clientType];
    if (!driver) {
      this.logger.error(
        `${clientType} database is not supported for column data backup`,
      );
      NcError.get(context).notImplemented(
        `${clientType} database is not supported for column data backup`,
      );
    }
    return { driver, baseModelSqlV2 };
  }

  async backup(
    context: NcContext,
    param: {
      sourceColumn: Column<any>;
      backupUid: string;
      forUndo?: boolean;
    },
  ): Promise<ColumnBackupRef> {
    const { driver, baseModelSqlV2 } = await this.resolveDriver(
      context,
      param.sourceColumn,
    );
    const identifier = ColumnDataBackupHandler.buildIdentifier({
      column: param.sourceColumn,
      backupUid: param.backupUid,
      forUndo: param.forUndo,
    });
    return driver.backupColumnData({
      baseModelSqlV2,
      sourceColumn: param.sourceColumn,
      identifier,
    });
  }

  async restore(
    context: NcContext,
    param: {
      destinationColumn: Column<any>;
      backupRef: ColumnBackupRef;
    },
  ): Promise<void> {
    const { driver, baseModelSqlV2 } = await this.resolveDriver(
      context,
      param.destinationColumn,
    );
    return driver.restoreBackupData({
      baseModelSqlV2,
      destinationColumn: param.destinationColumn,
      backupRef: param.backupRef,
    });
  }

  async drop(
    context: NcContext,
    param: { backupRef: ColumnBackupRef },
  ): Promise<void> {
    const model = await Model.get(context, param.backupRef.fkModelId).catch(
      () => null,
    );
    if (!model) return;

    const stubColumn = {
      id: param.backupRef.sourceColumnId,
      fk_model_id: param.backupRef.fkModelId,
      column_name: param.backupRef.backupColumnName,
    } as unknown as Column<any>;

    const { driver, baseModelSqlV2 } = await this.resolveDriver(
      context,
      stubColumn,
    );

    return driver.dropBackup({
      baseModelSqlV2,
      backupRef: param.backupRef,
    });
  }
}
