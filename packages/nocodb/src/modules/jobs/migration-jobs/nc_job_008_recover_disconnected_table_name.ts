import { Injectable } from '@nestjs/common';
import type { BaseModelSqlv2 } from 'src/db/BaseModelSqlv2';
import type CustomKnex from '~/db/CustomKnex';
import type { MetaService } from '~/meta/meta.service';
import { Model, Source } from '~/models';
import { MetaTable } from '~/utils/globals';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';
import SimpleLRUCache from '~/utils/cache';
import { isEE } from '~/utils';
import Noco from '~/Noco';

const PARALLEL_LIMIT = +process.env.NC_ORDER_MIGRATION_PARALLEL_LIMIT || 10;

const renameTableSql = {
  mariadb: 'RENAME TABLE ?? TO ??',
  mysql2: 'RENAME TABLE ?? TO ??',
  mysql: 'RENAME TABLE ?? TO ??',
  pg: 'ALTER TABLE ?? RENAME TO ??',
  sqlite3: 'ALTER TABLE ?? RENAME TO ??',
};

const replaceQuestionMarkWithPlaceholderPg = (tableName: string) => {
  let index = 0;
  return tableName.split('?').reduce((tn, token) => {
    if (index > 0) {
      token = '$' + index.toString() + token;
    }
    tn += token;
    index++;
    return tn;
  }, '');
};

const checkIfTableNameExists = (
  basemodel: BaseModelSqlv2,
  tableName: string,
  knex: CustomKnex,
) => {
  let knexSchema: any = knex.schema;
  if (basemodel.schema) {
    knexSchema = knexSchema.withSchema(basemodel.schema);
  }
  return knexSchema.withSchema(basemodel.schema).hasTable(tableName);
};

@Injectable()
export class RecoverDisconnectedTableNames {
  private processingModels: {
    fk_model_id: string;
    processing: boolean;
  }[] = [{ fk_model_id: 'placeholder', processing: true }];
  private processedModelsCount = 0;
  private cache = new SimpleLRUCache(1000);

  constructor() {}

  log = (...msgs: string[]) => {
    console.log('[nc_job_008_recover_disconnected_table_name]: ', ...msgs);
  };

  logExecutionTime(message: string, hrTime) {
    const [seconds, nanoseconds] = process.hrtime(hrTime);

    // reset hrTime
    hrTime = process.hrtime();

    const elapsedSeconds = seconds + nanoseconds / 1e9;
    this.log(`${message} in ${elapsedSeconds}s`);
  }

  getModelsToBeProcessedQueryBuilder(ncMeta: MetaService) {
    return ncMeta
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
          .where(`${MetaTable.MODELS}.table_name`, 'like', '%?%')
          .orWhere(`${MetaTable.MODELS}.table_name`, 'like', '%$%');
      });
  }

  async job() {
    const ncMeta = Noco.ncMeta;

    try {
      this.cache.clear();
      const totalHrTime = process.hrtime();

      const numberOfModelsToBeProcessed = +(
        await this.getModelsToBeProcessedQueryBuilder(ncMeta)
          .count('*', { as: 'count' })
          .first()
      )?.count;

      this.log(`Total models to be processed: ${numberOfModelsToBeProcessed}`);

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const modelToProcessQb = this.getModelsToBeProcessedQueryBuilder(ncMeta)
          .select([
            `${MetaTable.MODELS}.id`,
            `${MetaTable.MODELS}.source_id`,
            `${MetaTable.MODELS}.table_name`,
            `${MetaTable.MODELS}.base_id`,
            ...(isEE ? [`${MetaTable.MODELS}.fk_workspace_id`] : []),
          ])
          .whereNotIn(
            `${MetaTable.MODELS}.id`,
            this.processingModels.map((m) => m.fk_model_id),
          )
          .orderBy(`${MetaTable.MODELS}.id`, 'asc')
          .limit(PARALLEL_LIMIT * 2);
        const modelsToProcess = await modelToProcessQb;
        if (!modelsToProcess?.length) break;
        for (const model of modelsToProcess) {
          this.processingModels.push({
            fk_model_id: model.id,
            processing: true,
          });
          try {
            await this.processModel(model, ncMeta);
          } catch (ex) {
            this.log(`Error processing model ${model.id}:`, ex.message);
          }
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      this.log(
        `Migration completed. Processed ${this.processedModelsCount} models`,
      );

      this.logExecutionTime('Migration job completed', totalHrTime);

      return true;
    } catch (error) {
      this.log('Migration failed:');
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
    ncMeta: MetaService,
  ) {
    try {
      const context = {
        base_id: modelData.base_id,
        workspace_id: modelData.fk_workspace_id,
      };
      const source = await this.cache.get(modelData.source_id, async () =>
        Source.get(context, modelData.source_id),
      );
      if (!(source as Source).isMeta()) {
        this.log(`Model ${modelData.id}:`, 'is not meta, skipping');
        return;
      }

      const dbDriver: CustomKnex = await NcConnectionMgrv2.get(source);
      const model = await Model.get(context, modelData.id);
      const baseModel = await Model.getBaseModelSQL(context, {
        model,
        source,
        dbDriver,
      });
      const tnPath = baseModel.getTnPath(model.table_name);
      let tableName = typeof tnPath === 'string' ? tnPath : tnPath.toQuery();
      if (['pg', 'postgres'].includes(source.type)) {
        tableName = replaceQuestionMarkWithPlaceholderPg(tableName);
      }
      // replacing table name must not use tn name (without schema)
      let replacingTableName = model.table_name;
      if (['pg', 'postgres'].includes(source.type)) {
        for (let i = 1; i <= 15; i++) {
          replacingTableName = replacingTableName.replaceAll(
            '$' + i.toString(),
            '_',
          );
        }
      }
      let counter = 1;
      replacingTableName = replacingTableName.replace(/[?$]/g, '_');
      const initialTableName = replacingTableName;
      while (
        await checkIfTableNameExists(baseModel, replacingTableName, dbDriver)
      ) {
        const oldReplacingTableName = replacingTableName;
        replacingTableName = `${initialTableName}_${counter}`;
        counter++;
        this.log(
          'Table ' +
            oldReplacingTableName +
            ' exists, replacing with ' +
            replacingTableName,
        );
      }
      this.log('Renaming table ' + tableName + ' to ' + replacingTableName);
      await dbDriver.raw(renameTableSql[source.type], [
        tableName,
        replacingTableName,
      ]);

      await ncMeta.metaUpdate(
        modelData.fk_workspace_id,
        modelData.base_id,
        MetaTable.MODELS,
        {
          table_name: replacingTableName,
        },
        modelData.id,
      );
      this.processedModelsCount++;
    } catch (error) {
      this.log(`Error processing model ${modelData.id}:`, error.message);
      throw error;
    }
  }
}
