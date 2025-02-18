import { Injectable } from '@nestjs/common';
import { PgDataMigration } from './formula-column-type-changer/pg-data-migration';
import type { FormulaDataMigrationDriver } from './formula-column-type-changer';
import type { BaseModelSqlv2 } from '~/db/BaseModelSqlv2';
import type { Column, FormulaColumn } from '~/models';
import type { NcContext } from 'nocodb-sdk';
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

  async migrateDataFromId({
    context,
    modelId,
    formulaColumnId,
    destinationColumnId,
    offset = 0,
    limit = DEFAULT_BATCH_LIMIT,
  }: {
    context: NcContext;
    modelId: string;
    formulaColumnId: string;
    destinationColumnId: string;
    offset?: number;
    limit?: number;
  }) {
    const baseModel = await getBaseModelSqlFromModelId({ context, modelId });
    await baseModel.model.getColumns(context);
    const formulaColumn = baseModel.model.columns.find(
      (k) => k.id === formulaColumnId,
    );
    const destinationColumn = baseModel.model.columns.find(
      (k) => k.id === destinationColumnId,
    );
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
