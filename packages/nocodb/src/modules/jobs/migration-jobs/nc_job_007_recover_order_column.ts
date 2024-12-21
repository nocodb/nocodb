import { Injectable } from '@nestjs/common';
import PQueue from 'p-queue';
import { OrderColumnMigration } from './nc_job_005_order_column';
import { isEE } from '~/utils';
import { MetaTable } from '~/utils/globals';
import { Model, Source } from '~/models';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';
import Noco from '~/Noco';

const PARALLEL_LIMIT = +process.env.NC_ORDER_MIGRATION_PARALLEL_LIMIT || 10;

const dropColumnSql = {
  mysql2: 'ALTER TABLE ?? DROP COLUMN ??',
  pg: 'ALTER TABLE ?? DROP COLUMN ?? CASCADE',
  sqlite3: 'ALTER TABLE ?? DROP COLUMN ??',
};

@Injectable()
export class RecoverOrderColumnMigration {
  private processingModels = [{ fk_model_id: 'placeholder', processing: true }];
  private processedModelsCount = 0;

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
    const ncMeta = Noco.ncMeta;

    try {
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
            if (isEE) builder.orWhere({ is_local: true });
          })
          .where((builder) => {
            builder
              .where(`${MetaTable.MODELS}.deleted`, false)
              .orWhereNull(`${MetaTable.MODELS}.deleted`);
          })
          .whereNotExists(function () {
            this.select(1)
              .from(MetaTable.COLUMNS)
              .whereRaw(
                `${MetaTable.COLUMNS}.fk_model_id = ${MetaTable.MODELS}.id`,
              )
              .where(`${MetaTable.COLUMNS}.uidt`, 'Order');
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
            if (isEE) builder.orWhere({ is_local: true });
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
          .whereNotExists(function () {
            this.select(1)
              .from(MetaTable.COLUMNS)
              .whereRaw(
                `${MetaTable.COLUMNS}.fk_model_id = ${MetaTable.MODELS}.id`,
              )
              .where(`${MetaTable.COLUMNS}.uidt`, 'Order');
          })
          .limit(PARALLEL_LIMIT * 2);

        if (!models?.length) break;

        for (const model of models) {
          this.processingModels.push({
            fk_model_id: model.id,
            processing: true,
          });

          queue
            .add(() => this.processModel(model))
            .catch((e) => {
              this.log(`Error processing model ${model.id}:`, e.message);
            });
        }
      }

      await queue.onIdle();

      this.log(
        `Migration completed. Processed ${this.processedModelsCount} models`,
      );

      this.logExecutionTime('Migration job completed', totalHrTime);

      return await this.orderColumnMigration.job();
    } catch (error) {
      this.log('Migration failed:');
      console.error(error);
      return false;
    }
  }

  private async processModel(modelData: {
    id: string;
    source_id: string;
    table_name: string;
    base_id: string;
    fk_workspace_id?: string;
  }) {
    try {
      const context = {
        base_id: modelData.base_id,
        workspace_id: modelData.fk_workspace_id,
      };

      const source = await Source.get(context, modelData.source_id);
      if (!source || (!source.isMeta() && (!isEE || !source.is_local))) {
        return;
      }

      const model = await Model.get(context, modelData.id);

      const realDbDriver = await NcConnectionMgrv2.get(
        new Source({
          ...source,
          upgraderMode: false,
        } as any),
      );

      const baseModel = await Model.getBaseModelSQL(context, {
        model,
        source,
        dbDriver: realDbDriver,
      });

      const query = dropColumnSql[realDbDriver.clientType()];

      await realDbDriver.raw(query, [baseModel.tnPath, 'nc_order']);

      this.processedModelsCount++;
    } catch (error) {
      this.log(`Error processing model ${modelData.id}:`, error.message);
      throw error;
    }
  }
}
