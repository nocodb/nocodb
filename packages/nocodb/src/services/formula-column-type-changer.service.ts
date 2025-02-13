import { Injectable } from '@nestjs/common';
import { type ColumnReqType, type NcContext, type UserType } from 'nocodb-sdk';
import { NcApiVersion, type NcRequest } from 'nocodb-sdk';
import { PgDataMigration } from './formula-column-type-changer/pg-data-migration';
import { ColumnsService } from './columns.service';
import type { ReusableParams } from './columns.service';
import type { FormulaDataMigrationDriver } from './formula-column-type-changer';
import type { BaseModelSqlv2 } from '~/db/BaseModelSqlv2';
import type { FormulaColumn } from '~/models';
import { Column, Model } from '~/models';
import { getBaseModelSqlFromModelId } from '~/helpers/dbHelpers';

export const DEFAULT_BATCH_LIMIT = 100000;

@Injectable()
export class FormulaColumnTypeChanger {
  constructor(protected readonly columnsService: ColumnsService) {
    const pgDriver = new PgDataMigration();
    this.dataMigrationDriver[pgDriver.dbDriverName] = pgDriver;
  }

  dataMigrationDriver: {
    [key: string]: FormulaDataMigrationDriver;
  } = {};

  async startChangeFormulaColumnType(
    context: NcContext,
    params: {
      req: NcRequest;
      columnId: string;
      newColumnType: ColumnReqType;
      user: UserType;
      reuse?: ReusableParams;
    },
  ) {
    const formulaColumn = await Column.get(context, { colId: params.columnId });
    const newColumn = await this.columnsService.columnAdd<NcApiVersion.V3>(
      context,
      {
        column: params.newColumnType,
        req: params.req,
        user: params.user,
        reuse: params.reuse,
        tableId: formulaColumn.fk_model_id,
        apiVersion: NcApiVersion.V3,
        suppressFormulaError: false,
      },
    );
    await this.migrateDataFromId(context, {
      formulaColumnId: formulaColumn.id,
      destinationColumnId: newColumn.id,
    });
  }
  async startMigrateData(
    context: NcContext,
    {
      formulaColumnId,
      destinationColumnId,
    }: {
      formulaColumnId: string;
      destinationColumnId: string;
    },
  ) {
    const formulaColumn = await Column.get(context, { colId: formulaColumnId });
    const model = await Model.getWithInfo(context, {
      id: formulaColumn.fk_model_id,
    });
    const baseModel = await getBaseModelSqlFromModelId({
      context,
      modelId: model.id,
    });
    const rowCount = await baseModel.count();
    
  }

  async migrateDataFromId(
    context: NcContext,
    {
      formulaColumnId,
      destinationColumnId,
      offset = 0,
      limit = DEFAULT_BATCH_LIMIT,
    }: {
      formulaColumnId: string;
      destinationColumnId: string;
      offset?: number;
      limit?: number;
    },
  ) {
    const formulaColumn = await Column.get(context, { colId: formulaColumnId });
    const destinationColumn = await Column.get(context, {
      colId: destinationColumnId,
    });
    const model = await Model.getWithInfo(context, {
      id: formulaColumn.fk_model_id,
    });
    const baseModel = await getBaseModelSqlFromModelId({
      context,
      modelId: model.id,
    });
    const formulaColumnOption =
      await formulaColumn.getColOptions<FormulaColumn>(context);
    return await this.migrateData({
      baseModelSqlV2: baseModel,
      formulaColumn,
      formulaColumnOption,
      destinationColumn,
      offset,
      limit,
    });
  }

  async migrateData({
    baseModelSqlV2,
    formulaColumn,
    formulaColumnOption,
    destinationColumn,
    offset = 0,
    limit = DEFAULT_BATCH_LIMIT,
  }: {
    baseModelSqlV2: BaseModelSqlv2;
    formulaColumn: Column<any>;
    destinationColumn: Column<any>;
    formulaColumnOption: FormulaColumn;
    offset?: number;
    limit?: number;
  }) {
    const qb = baseModelSqlV2.dbDriver;
    const dbDriver = this.dataMigrationDriver[qb.clientType()];
    if (!dbDriver) {
      // TODO: better error
      throw new Error('migration is not supported for this driver yet');
    }

    await dbDriver.migrate({
      baseModelSqlV2,
      destinationColumn,
      formulaColumn,
      formulaColumnOption,
      limit,
      offset,
    });
  }
}
