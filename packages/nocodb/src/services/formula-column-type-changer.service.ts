import {
  forwardRef,
  Inject,
  Injectable,
  NotImplementedException,
} from '@nestjs/common';
import { NcApiVersion, type NcContext, type NcRequest } from 'nocodb-sdk';
import { generateUpdateAuditV1Payload } from 'src/utils';
import type {
  AuditV1,
  ColumnReqType,
  DataUpdatePayload,
  UserType,
} from 'nocodb-sdk';
import type { BaseModelSqlv2 } from '~/db/BaseModelSqlv2';
import type { FormulaColumn } from '~/models';
import type { ReusableParams } from '~/services/columns.service.type';
import type { FormulaDataMigrationDriver } from '~/services/formula-column-type-changer';
import type { IFormulaColumnTypeChanger } from './formula-column-type-changer.types';
import {
  getBaseModelSqlFromModelId,
  isDataAuditEnabled,
} from '~/helpers/dbHelpers';
import { Audit, Column } from '~/models';
import { ColumnsService } from '~/services/columns.service';
import { MysqlDataMigration } from '~/services/formula-column-type-changer/mysql-data-migration';
import { PgDataMigration } from '~/services/formula-column-type-changer/pg-data-migration';
import { SqliteDataMigration } from '~/services/formula-column-type-changer/sqlite-data-migration';

export const DEFAULT_BATCH_LIMIT = 100000;

@Injectable()
export class FormulaColumnTypeChanger implements IFormulaColumnTypeChanger {
  constructor(
    @Inject(forwardRef(() => ColumnsService))
    private readonly columnsService: ColumnsService,
  ) {
    const pgDriver = new PgDataMigration();
    const mysqlDriver = new MysqlDataMigration();
    const sqliteDriver = new SqliteDataMigration();
    this.dataMigrationDriver['postgre'] = pgDriver;
    this.dataMigrationDriver[pgDriver.dbDriverName] = pgDriver;
    this.dataMigrationDriver['mariadb'] = mysqlDriver;
    this.dataMigrationDriver['mysql2'] = mysqlDriver;
    this.dataMigrationDriver[mysqlDriver.dbDriverName] = mysqlDriver;
    this.dataMigrationDriver[sqliteDriver.dbDriverName] = sqliteDriver;
    this.dataMigrationDriver['sqlite3'] = sqliteDriver;
  }

  dataMigrationDriver: {
    [key: string]: FormulaDataMigrationDriver;
  } = {};

  async startChangeFormulaColumnType(
    context: NcContext,
    params: {
      req: NcRequest;
      formulaColumn: Column;
      user: UserType;
      reuse?: ReusableParams;
      newColumnRequest: ColumnReqType & { colOptions?: any };
    },
  ) {
    const baseModel = await getBaseModelSqlFromModelId({
      context,
      modelId: params.formulaColumn.fk_model_id,
    });
    if (!this.dataMigrationDriver[baseModel.dbDriver.clientType()]) {
      throw new NotImplementedException(
        `${baseModel.dbDriver.clientType()} database is not supported in this operation`,
      );
    }
    const oldTitle = params.formulaColumn.title;
    if (params.newColumnRequest.title === oldTitle) {
      // we rename the alias first so the new created temporary column
      // do not cause duplicated alias
      await Column.updateAlias(context, params.formulaColumn.id, {
        title: '__nc_temp_field',
      });
    }

    let newColumn: Column;
    try {
      newColumn = await this.columnsService.columnAdd(context, {
        tableId: baseModel.model.id,
        column: params.newColumnRequest,
        req: params.req,
        user: params.user,
        apiVersion: NcApiVersion.V3,
        reuse: params.reuse,
        suppressFormulaError: true,
      });

      try {
        await this.startMigrateData(context, {
          formulaColumn: params.formulaColumn,
          destinationColumn: newColumn,
          baseModel,
          req: params.req,
        });
      } catch (ex) {
        await this.columnsService.columnDelete(context, {
          columnId: newColumn.id,
          req: params.req,
          user: params.user,
          reuse: params.reuse,
          forceDeleteSystem: false,
        });
        throw ex;
      }
    } catch (ex) {
      // when failed during create new column for whatever reason
      // we need to rollback the old column name / title
      if (params.newColumnRequest.title === oldTitle) {
        await Column.updateAlias(context, params.formulaColumn.id, {
          title: oldTitle,
        });
      }
      throw ex;
    }
    return await Column.updateFormulaColumnToNewType(context, {
      formulaColumn: params.formulaColumn,
      destinationColumn: newColumn,
    });
  }

  async startMigrateData(
    context: NcContext,
    {
      formulaColumn,
      destinationColumn,
      baseModel,
      req,
    }: {
      formulaColumn: Column;
      destinationColumn: Column;
      baseModel?: BaseModelSqlv2;
      req: NcRequest;
    },
  ) {
    baseModel =
      baseModel ??
      (await getBaseModelSqlFromModelId({
        context,
        modelId: formulaColumn.fk_model_id,
      }));
    const rowCount = await baseModel.count();
    if (rowCount === 0) {
      return;
    }
    const formulaColumnOption =
      await formulaColumn.getColOptions<FormulaColumn>(context);
    for (let i = 0; i < rowCount; i += DEFAULT_BATCH_LIMIT) {
      await this.migrateData({
        baseModelSqlV2: baseModel,
        destinationColumn,
        formulaColumn,
        formulaColumnOption,
        offset: i,
        limit: DEFAULT_BATCH_LIMIT,
        req,
      });
    }
  }

  async migrateData({
    baseModelSqlV2,
    formulaColumn,
    formulaColumnOption,
    destinationColumn,
    offset = 0,
    limit = DEFAULT_BATCH_LIMIT,
    req,
  }: {
    baseModelSqlV2: BaseModelSqlv2;
    formulaColumn: Column<any>;
    destinationColumn: Column<any>;
    formulaColumnOption: FormulaColumn;
    req: NcRequest;
    offset?: number;
    limit?: number;
  }) {
    const qb = baseModelSqlV2.dbDriver;
    const dataMigrationDriver = this.dataMigrationDriver[qb.clientType()];
    if (!dataMigrationDriver) {
      throw new NotImplementedException(
        `${qb.clientType()} database is not supported in this operation`,
      );
    }

    const updatedRows = await dataMigrationDriver.migrate({
      baseModelSqlV2,
      destinationColumn,
      formulaColumn,
      formulaColumnOption,
      limit,
      offset,
    });
    if (isDataAuditEnabled()) {
      const auditPayloads: AuditV1<DataUpdatePayload>[] = [];
      for (const row of updatedRows) {
        auditPayloads.push(
          await generateUpdateAuditV1Payload({
            baseModelSqlV2,
            rowId: row.primaryKeys,
            data: row.row,
            oldData: {
              ...row.row,
              [destinationColumn.title]: null,
            },
            req,
          }),
        );
      }
      await Promise.all(
        auditPayloads.map((auditPayload) => Audit.insert(auditPayload)),
      );
    }
  }
}
