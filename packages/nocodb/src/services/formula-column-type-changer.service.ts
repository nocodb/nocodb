import { Injectable } from '@nestjs/common';
import { type NcContext } from 'nocodb-sdk';
import { type NcRequest } from 'nocodb-sdk';
import { PgDataMigration } from './formula-column-type-changer/pg-data-migration';
import type { ColumnReqType } from 'nocodb-sdk';
import type { FormulaDataMigrationDriver } from './formula-column-type-changer';
import type { BaseModelSqlv2 } from '~/db/BaseModelSqlv2';
import type { FormulaColumn } from '~/models';
import { Column, Model } from '~/models';
import { getBaseModelSqlFromModelId } from '~/helpers/dbHelpers';

export const DEFAULT_BATCH_LIMIT = 100000;

@Injectable()
export class FormulaColumnTypeChanger {
  constructor() {
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
      formulaColumn: Column;
      newColumnRequest: ColumnReqType & { colOptions?: any };
      // we need to do this because circular dependency between
      // this class and columns service
      createNewColumnHandle: () => Promise<Column<any>>;
    },
  ) {
    const oldTitle = params.formulaColumn.title;
    if (params.newColumnRequest.title === oldTitle) {
      // we rename the alias first so the new created temporary column
      // do not cause duplicated alias
      await Column.updateAlias(context, params.formulaColumn.id, {
        title: '__nc_temp_field',
      });
    }
    const newColumn = await params.createNewColumnHandle();
    try {
      await this.startMigrateData(context, {
        formulaColumn: params.formulaColumn,
        destinationColumn: newColumn,
      });
    } catch (ex) {
      await Column.delete(context, newColumn.id);
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
    }: {
      formulaColumn: Column;
      destinationColumn: Column;
    },
  ) {
    const model = await Model.getWithInfo(context, {
      id: formulaColumn.fk_model_id,
    });
    const baseModel = await getBaseModelSqlFromModelId({
      context,
      modelId: model.id,
    });
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
