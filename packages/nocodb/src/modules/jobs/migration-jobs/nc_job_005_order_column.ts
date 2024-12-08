import { Injectable } from '@nestjs/common';
import debug from 'debug';
import PQueue from 'p-queue';
import { UITypes } from 'nocodb-sdk';
import type { MetaService } from '~/meta/meta.service';
import { Column, Model, Source } from '~/models';
import { MetaTable } from '~/utils/globals';
import { isEE } from '~/utils';
import Noco from '~/Noco';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';
import ProjectMgrv2 from '~/db/sql-mgr/v2/ProjectMgrv2';
import {
  getUniqueColumnAliasName,
  getUniqueColumnName,
} from '~/helpers/getUniqueName';
import getColumnPropsFromUIDT from '~/helpers/getColumnPropsFromUIDT';
import { Altered } from '~/services/columns.service';

const TEMP_TABLE = 'nc_temp_processed_order_models';
const BATCH_SIZE = 100;
const PARALLEL_LIMIT = 2;

@Injectable()
export class OrderColumnMigration {
  private readonly debugLog = debug('nc:migration-jobs:order-column');
  private readonly log = (...msgs: string[]) =>
    console.log('[nc_job_005_order_column]: ', ...msgs);

  private async createTempTable(ncMeta: MetaService) {
    if (!(await ncMeta.knexConnection.schema.hasTable(TEMP_TABLE))) {
      await ncMeta.knexConnection.schema.createTable(TEMP_TABLE, (table) => {
        table.increments('id').primary();
        table.string('fk_model_id').notNullable();
        table.boolean('completed');
        table.text('error').nullable();
        table.index('fk_model_id');
      });
    }
  }

  private async updateModelStatus(
    ncMeta: MetaService,
    modelId: string,
    status: boolean,
    error?: string,
  ) {
    await ncMeta
      .knexConnection(TEMP_TABLE)
      .insert({ fk_model_id: modelId, completed: status, error });
  }

  private async populateOrderValues(
    dbDriver: any,
    baseModel: any,
    model: any,
    source: any,
    newColumn: any,
  ) {
    const aiColumn = model.columns.find((c) => c.ai);
    const pkColumn = model.primaryKeys[0]?.column_name;

    if (aiColumn) {
      await dbDriver.raw(`UPDATE ?? SET ?? = ??`, [
        baseModel.getTnPath(model.table_name),
        newColumn.column_name,
        aiColumn.column_name,
      ]);
      return;
    }

    if (!pkColumn) return;

    const sql = {
      mysql2: `UPDATE ?? SET ?? = ROW_NUMBER() OVER (ORDER BY ?? ASC)`,
      pg: `UPDATE ?? t SET ?? = s.rn FROM (SELECT ??, ROW_NUMBER() OVER (ORDER BY ?? ASC) rn FROM ??) s WHERE t.?? = s.??`,
      sqlite3: `WITH rn AS (SELECT ??, ROW_NUMBER() OVER (ORDER BY ?? ASC) rn FROM ??) UPDATE ?? SET ?? = (SELECT rn FROM rn WHERE rn.?? = ??.??)`,
    };

    const params = {
      mysql2: [
        baseModel.getTnPath(model.table_name),
        newColumn.column_name,
        pkColumn,
      ],
      pg: [
        baseModel.getTnPath(model.table_name),
        newColumn.column_name,
        pkColumn,
        pkColumn,
        baseModel.getTnPath(model.table_name),
        pkColumn,
        pkColumn,
      ],
      sqlite3: [
        pkColumn,
        pkColumn,
        baseModel.getTnPath(model.table_name),
        baseModel.getTnPath(model.table_name),
        newColumn.column_name,
        pkColumn,
        baseModel.getTnPath(model.table_name),
        pkColumn,
      ],
    };

    await dbDriver.raw(sql[source.type], params[source.type]);
  }

  private async cleanupFailedColumn(
    sqlMgr: any,
    source: any,
    model: any,
    newColumn: any,
  ) {
    const deleteUpdateBody = {
      ...model,
      tn: model.table_name,
      originalColumns: model.columns.map((c) => ({
        ...c,
        cn: c.column_name,
        cno: c.column_name,
      })),
      columns: [...model.columns, newColumn].map((c) => {
        if (c.column_name === newColumn.column_name) {
          return {
            ...c,
            cn: c.column_name,
            cno: c.column_name,
            altered: Altered.DELETE_COLUMN,
          };
        }
        (c as any).cn = c.column_name;
        return c;
      }),
    };

    await sqlMgr.sqlOpPlus(source, 'tableUpdate', deleteUpdateBody);
  }

  private async addOrderColumn(
    model: Model,
    source: any,
    context: any,
    ncMeta: MetaService,
    sqlMgr: any,
  ) {
    const newColumn = {
      ...(await getColumnPropsFromUIDT(
        {
          uidt: UITypes.Order,
          column_name: getUniqueColumnName(model.columns, 'nc_order'),
          title: getUniqueColumnAliasName(model.columns, 'order'),
        },
        source,
      )),
      cdf: null,
      system: true,
      altered: Altered.NEW_COLUMN,
    };

    const tableUpdateBody = {
      ...model,
      tn: model.table_name,
      originalColumns: model.columns.map((c) => ({ ...c, cn: c.column_name })),
      columns: [...model.columns, newColumn].map((c) => ({
        ...c,
        cn: c.column_name,
      })),
    };

    await sqlMgr.sqlOpPlus(source, 'tableUpdate', tableUpdateBody);
    return newColumn;
  }

  private async processModel(
    modelData: {
      id: string;
      source_id: string;
      fk_workspace_id?: string;
      base_id: string;
    },
    ncMeta: MetaService,
  ) {
    const { id: modelId, source_id, base_id } = modelData;
    const context = { workspace_id: modelData?.fk_workspace_id, base_id };

    try {
      const source = await Source.get(context, source_id);
      if (!source || (!source.isMeta() && (!isEE || !source.is_local))) {
        await this.updateModelStatus(ncMeta, modelId, false, 'Invalid source');
        return;
      }

      const dbDriver = await NcConnectionMgrv2.get(source);
      const baseModel = await Model.getBaseModelSQL(context, {
        id: modelId,
        dbDriver,
      });
      const model = await Model.get(context, modelId);
      await model.getColumns(context);

      if (model.columns.find((c) => c.uidt === UITypes.Order)) {
        await this.updateModelStatus(ncMeta, modelId, true);
        return;
      }

      const sqlMgr = ProjectMgrv2.getSqlMgr(
        context,
        { id: source.base_id },
        ncMeta,
      );

      const newColumn = await this.addOrderColumn(
        model,
        source,
        context,
        ncMeta,
        sqlMgr,
      );

      try {
        await this.populateOrderValues(
          dbDriver,
          baseModel,
          model,
          source,
          newColumn,
        );

        await Column.insert(
          context,
          {
            ...newColumn,
            system: true,
            fk_model_id: model.id,
          },
          ncMeta,
        );

        await this.updateModelStatus(ncMeta, modelId, true);
      } catch (error) {
        await this.cleanupFailedColumn(sqlMgr, source, model, newColumn);
        throw error;
      }
    } catch (error) {
      await this.updateModelStatus(ncMeta, modelId, false, error.message);
      throw error;
    }
  }

  private getModelsQuery(
    ncMeta: MetaService,
    skipModels: Set<string>,
    processingModels: any[],
  ) {
    return ncMeta
      .knexConnection(MetaTable.MODELS)
      .select([
        `${MetaTable.MODELS}.id`,
        'source_id',
        `${MetaTable.MODELS}.base_id`,
        ...(isEE ? [`${MetaTable.MODELS}.fk_workspace_id`,] : []),
      ])
      .whereNotIn(`${MetaTable.MODELS}.id`, [...skipModels])
      .whereNotIn(
        `${MetaTable.MODELS}.id`,
        processingModels.map((m) => m.id),
      )
      .whereNotExists(function () {
        this.select('*')
          .from(TEMP_TABLE)
          .whereRaw(`${TEMP_TABLE}.fk_model_id = ${MetaTable.MODELS}.id`)
          .where('completed', true);
      })
      .join(
        MetaTable.SOURCES,
        `${MetaTable.MODELS}.source_id`,
        '=',
        `${MetaTable.SOURCES}.id`,
      )
      .where((builder) => {
        builder.where(`${MetaTable.SOURCES}.is_meta`, true);
        if (isEE) builder.orWhere({ is_local: true });
      })
      .limit(BATCH_SIZE);
  }

  async job() {
    const ncMeta = Noco.ncMeta;

    try {
      await this.createTempTable(ncMeta);

      const numberOfModelsToBeProcessed = (
        await ncMeta
          .knexConnection(MetaTable.MODELS)
          .join(
            MetaTable.SOURCES,
            `${MetaTable.MODELS}.source_id`,
            '=',
            `${MetaTable.SOURCES}.id`,
          )
          .where((builder) => {
            builder.where(`${MetaTable.SOURCES}.is_meta`, true);
            if (isEE) builder.orWhere({ is_local: true });
          })
          .whereNotExists(function () {
            this.select('*')
              .from(TEMP_TABLE)
              .whereRaw(`${TEMP_TABLE}.fk_model_id = ${MetaTable.MODELS}.id`)
              .where('completed', true);
          })
          .count('*', { as: 'count' })
          .first()
      )?.count;

      this.log(`Found ${numberOfModelsToBeProcessed} models to process`);

      const skipModels = new Set(['placeholder']);
      let processingModels = [{ id: 'placeholder', processing: true }];
      let processedModelsCount = 0;

      const queue = new PQueue({ concurrency: PARALLEL_LIMIT });

      while (true) {
        if (queue.pending > PARALLEL_LIMIT) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          continue;
        }

        processingModels = processingModels.filter((m) => m.processing);
        const models = await this.getModelsQuery(
          ncMeta,
          skipModels,
          processingModels,
        );

        if (!models?.length) break;

        for (const model of models) {
          processingModels.push({ id: model.id, processing: true });
          await queue.add(async () => {
            try {
              await this.processModel(model, ncMeta);
            } catch (e) {
              this.log(`Error processing model ${model.id}:`, e);
              skipModels.add(model.id);
            } finally {
              const item = processingModels.find((m) => m.id === model.id);
              if (item) item.processing = false;
              processedModelsCount++;
              this.log(
                `Processed ${processedModelsCount} of ${numberOfModelsToBeProcessed} models`,
              );
            }
          });
        }
      }

      await queue.onIdle();
      // TODO: Drop temp table manually for now
      // await ncMeta.knexConnection.schema.dropTableIfExists(TEMP_TABLE);

      this.log(
        `Migration completed. Processed ${processedModelsCount} of ${numberOfModelsToBeProcessed} models`,
      );
      return true;
    } catch (error) {
      this.log('Migration failed:', error);
      return false;
    }
  }
}
