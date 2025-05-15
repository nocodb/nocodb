import { Injectable } from '@nestjs/common';
import PQueue from 'p-queue';
import { OrderColumnMigration } from './nc_job_005_order_column';
import type CustomKnex from '~/db/CustomKnex';
import { isEE } from '~/utils';
import { MetaTable } from '~/utils/globals';
import { Column, Model, Source } from '~/models';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';
import SimpleLRUCache from '~/utils/cache';
import Upgrader from '~/Upgrader';

const PARALLEL_LIMIT = +process.env.NC_ORDER_MIGRATION_PARALLEL_LIMIT || 10;

const dropColumnSql = {
  mysql2: 'ALTER TABLE ?? DROP COLUMN ??',
  mysql: 'ALTER TABLE ?? DROP COLUMN ??',
  pg: 'ALTER TABLE ?? DROP COLUMN ?? CASCADE',
  sqlite3: 'ALTER TABLE ?? DROP COLUMN ??',
};

@Injectable()
export class RecoverOrderColumnMigration {
  private processingModels = [{ fk_model_id: 'placeholder', processing: true }];
  private processedModelsCount = 0;
  private cache = new SimpleLRUCache(1000);

  constructor(private readonly orderColumnMigration: OrderColumnMigration) {}

  log = (...msgs: string[]) => {
    console.log('[nc_job_007_recover-order-column]: ', ...msgs);
  };

  logExecutionTime(message: string, hrTime) {
    const [seconds, nanoseconds] = process.hrtime(hrTime);

    // reset hrTime
    hrTime = process.hrtime();

    const elapsedSeconds = seconds + nanoseconds / 1e9;
    this.log(`${message} in ${elapsedSeconds}s`);
  }

  async job() {
    const ncMeta = new Upgrader();

    try {
      this.cache.clear();
      ncMeta.enableUpgraderMode();
      const totalHrTime = process.hrtime();

      const numberOfModelsToBeProcessed = +(
        await ncMeta
          .knexConnection(MetaTable.MODELS)
          .join(
            MetaTable.SOURCES,
            `${MetaTable.MODELS}.source_id`,
            '=',
            `${MetaTable.SOURCES}.id`,
          )
          .where(`${MetaTable.MODELS}.mm`, false)
          .where((builder) => {
            builder.where(`${MetaTable.SOURCES}.is_meta`, true);
            builder.orWhere({ is_local: true });
          })
          .where((builder) => {
            builder
              .where(`${MetaTable.MODELS}.deleted`, false)
              .orWhereNull(`${MetaTable.MODELS}.deleted`);
          })
          .where((builder) => {
            builder
              .whereNotExists(function () {
                this.select(1)
                  .from(MetaTable.COLUMNS)
                  .whereRaw(
                    `${MetaTable.COLUMNS}.fk_model_id = ${MetaTable.MODELS}.id`,
                  )
                  .where(`${MetaTable.COLUMNS}.uidt`, 'Order');
              })
              .orWhereExists(function () {
                this.select(1)
                  .from(MetaTable.COLUMNS)
                  .whereRaw(
                    `${MetaTable.COLUMNS}.fk_model_id = ${MetaTable.MODELS}.id`,
                  )
                  .where(`${MetaTable.COLUMNS}.uidt`, 'Decimal')
                  .where(`${MetaTable.COLUMNS}.system`, true)
                  .where(`${MetaTable.COLUMNS}.column_name`, '=', 'nc_order');
              });
          })
          .count('*', { as: 'count' })
          .first()
      )?.count;

      this.log(`Total models to be processed: ${numberOfModelsToBeProcessed}`);

      const queue = new PQueue({ concurrency: PARALLEL_LIMIT });

      // eslint-disable-next-line no-constant-condition
      while (true) {
        if (queue.pending > PARALLEL_LIMIT * 2) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          continue;
        }

        this.processingModels = this.processingModels.filter(
          (m) => m.processing,
        );

        const models = await ncMeta
          .knexConnection(MetaTable.MODELS)
          .select([
            `${MetaTable.MODELS}.id`,
            `${MetaTable.MODELS}.source_id`,
            `${MetaTable.MODELS}.table_name`,
            `${MetaTable.MODELS}.base_id`,
            ...(isEE ? [`${MetaTable.MODELS}.fk_workspace_id`] : []),
          ])
          .join(
            MetaTable.SOURCES,
            `${MetaTable.MODELS}.source_id`,
            '=',
            `${MetaTable.SOURCES}.id`,
          )
          .where(`${MetaTable.MODELS}.mm`, false)
          .where((builder) => {
            builder.where(`${MetaTable.SOURCES}.is_meta`, true);
            builder.orWhere({ is_local: true });
          })
          .where((builder) => {
            builder
              .where(`${MetaTable.MODELS}.deleted`, false)
              .orWhereNull(`${MetaTable.MODELS}.deleted`);
          })
          .whereNotIn(
            `${MetaTable.MODELS}.id`,
            this.processingModels.map((m) => m.fk_model_id),
          )
          .where((builder) => {
            builder
              .whereNotExists(function () {
                this.select(1)
                  .from(MetaTable.COLUMNS)
                  .whereRaw(
                    `${MetaTable.COLUMNS}.fk_model_id = ${MetaTable.MODELS}.id`,
                  )
                  .where(`${MetaTable.COLUMNS}.uidt`, 'Order');
              })
              .orWhereExists(function () {
                this.select(1)
                  .from(MetaTable.COLUMNS)
                  .whereRaw(
                    `${MetaTable.COLUMNS}.fk_model_id = ${MetaTable.MODELS}.id`,
                  )
                  .where(`${MetaTable.COLUMNS}.uidt`, 'Decimal')
                  .where(`${MetaTable.COLUMNS}.system`, true)
                  .where(`${MetaTable.COLUMNS}.column_name`, '=', 'nc_order');
              });
          })
          .limit(PARALLEL_LIMIT * 2);

        if (!models?.length) break;

        for (const model of models) {
          this.processingModels.push({
            fk_model_id: model.id,
            processing: true,
          });

          queue
            .add(() => this.processModel(model, ncMeta))
            .catch((e) => {
              this.log(`Error processing model ${model.id}:`, e.message);
            });
        }
      }

      await queue.onIdle();

      await ncMeta.disableUpgraderMode();

      this.log(
        `Migration completed. Processed ${this.processedModelsCount} models`,
      );

      this.logExecutionTime('Migration job completed', totalHrTime);

      return await this.orderColumnMigration.job();
    } catch (error) {
      this.log('Migration failed:');
      console.error(error);
      await ncMeta.disableUpgraderMode();
      return false;
    }
  }

  private async processModel(
    modelData: {
      id: string;
      source_id: string;
      table_name: string;
      base_id: string;
      fk_workspace_id?: string;
    },
    ncMeta: Upgrader,
  ) {
    try {
      const context = {
        base_id: modelData.base_id,
        workspace_id: modelData.fk_workspace_id,
      };

      const originalSource = await this.cache.get(
        modelData.source_id,
        async () => Source.get(context, modelData.source_id),
      );

      if (!originalSource || !originalSource.isMeta()) {
        return;
      }

      const source = new Source({
        ...originalSource,
        upgraderMode: true,
        upgraderQueries: [],
      });

      const dbDriver: CustomKnex = await NcConnectionMgrv2.get(source);

      const model = await Model.get(context, modelData.id);

      const baseModel = await Model.getBaseModelSQL(context, {
        model,
        source,
        dbDriver,
      });

      const tnPath = baseModel.getTnPath(model.table_name);

      const query = dbDriver
        .raw(dropColumnSql[dbDriver.clientType()], [tnPath, 'nc_order'])
        .toQuery();

      const realDbDriver = await NcConnectionMgrv2.get(
        new Source({
          ...source,
          upgraderMode: false,
        } as any),
      );

      await realDbDriver.raw(query);

      await model.getColumns(context, ncMeta);

      const decimalOrderCol = model.columns.find(
        (c) =>
          c.uidt === 'Decimal' &&
          c.system &&
          c.column_name.startsWith('nc_order'),
      );

      if (decimalOrderCol) {
        await Column.delete(context, decimalOrderCol.id, ncMeta);
      }

      await ncMeta.runUpgraderQueries();

      this.processedModelsCount++;
    } catch (error) {
      this.log(`Error processing model ${modelData.id}:`, error.message);
      throw error;
    }
  }
}
