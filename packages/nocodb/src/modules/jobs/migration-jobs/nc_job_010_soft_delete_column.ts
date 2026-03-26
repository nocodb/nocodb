import { Injectable, Logger } from '@nestjs/common';
import debug from 'debug';
import PQueue from 'p-queue';
import { isDeletedCol, UITypes } from 'nocodb-sdk';
import type { MetaService } from '~/meta/meta.service';
import type { Knex } from 'knex';
import type SqlMgrv2 from '~/db/sql-mgr/v2/SqlMgrv2';
import type CustomKnex from '~/db/CustomKnex';
import { Column, Model, Source } from '~/models';
import { MetaTable } from '~/utils/globals';
import SimpleLRUCache from '~/utils/cache';
import { isEE } from '~/utils';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';
import ProjectMgrv2 from '~/db/sql-mgr/v2/ProjectMgrv2';
import {
  getUniqueColumnAliasName,
  getUniqueColumnName,
} from '~/helpers/getUniqueName';
import getColumnPropsFromUIDT from '~/helpers/getColumnPropsFromUIDT';
import { Altered } from '~/services/columns.service';
import Upgrader from '~/Upgrader';
import Noco from '~/Noco';

const PARALLEL_LIMIT =
  +process.env.NC_SOFT_DELETE_MIGRATION_PARALLEL_LIMIT || 10;
// TODO: Drop nc_temp_processed_soft_delete after migration is confirmed complete across all deployments
const TEMP_TABLE = 'nc_temp_processed_soft_delete';

const propsByClientType = {};

const memoizedGetColumnPropsFromUIDT = async (source: Source) => {
  const clientType = source.type;

  if (!propsByClientType[clientType]) {
    propsByClientType[clientType] = await getColumnPropsFromUIDT(
      {
        uidt: UITypes.Deleted,
        column_name: '__nc_deleted',
        title: '__nc_deleted',
      },
      source,
    );
  }

  return propsByClientType[clientType];
};

@Injectable()
export class SoftDeleteColumnMigration {
  private readonly debugLog = debug('nc:migration-jobs:soft-delete-column');
  private readonly logger = new Logger(SoftDeleteColumnMigration.name);
  private readonly log = (...msgs: string[]) =>
    this.logger.log(`${msgs.join(' ')}`);

  private processingModels = [{ fk_model_id: 'placeholder', processing: true }];
  private processedModelsCount = 0;
  private cache = new SimpleLRUCache(1000);

  async job() {
    if (!(await Noco.ncMeta.knexConnection.schema.hasTable(TEMP_TABLE))) {
      await Noco.ncMeta.knexConnection.schema.createTable(
        TEMP_TABLE,
        (table) => {
          table.increments('id').primary();
          table.string('fk_model_id').notNullable();
          table.boolean('completed').defaultTo(false);
          table.text('error').nullable();
          table.index('fk_model_id');
        },
      );
    }

    // Remove incomplete models from previous run
    await Noco.ncMeta
      .knexConnection(TEMP_TABLE)
      .delete()
      .where('completed', false);

    // Reset processed models count
    this.processingModels = [{ fk_model_id: 'placeholder', processing: true }];
    this.processedModelsCount = 0;

    // Clear cache
    this.cache.clear();

    const ncMeta = new Upgrader();

    try {
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
          .whereNotIn(
            `${MetaTable.MODELS}.id`,
            ncMeta.knexConnection(TEMP_TABLE).select('fk_model_id'),
          )
          .count('*', { as: 'count' })
          .first()
      )?.count;

      this.log(
        `Found ${numberOfModelsToBeProcessed} models to process for soft delete column`,
      );

      const wrapper = async (model: {
        id: string;
        source_id: string;
        fk_workspace_id?: string;
        base_id: string;
      }) => {
        try {
          await this.processModel(model, ncMeta);
        } catch (e) {
          this.logger.error(
            `Error processing model ${model.id}: ${e.message}`,
            e.stack,
          );
          await this.updateModelStatus(Noco.ncMeta, model.id, false, e.message);
        } finally {
          const item = this.processingModels.find(
            (m) => m.fk_model_id === model.id,
          );

          if (item) {
            item.processing = false;
          }

          this.processedModelsCount++;
          this.log(
            `Processed ${this.processedModelsCount} of ${numberOfModelsToBeProcessed} models`,
          );
        }
      };

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

        const models = await this.getModelsQuery(ncMeta);

        if (!models?.length) break;

        const processModels = models.splice(0);

        for (const model of processModels) {
          this.processingModels.push({
            fk_model_id: model.id,
            processing: true,
          });

          queue
            .add(() => wrapper(model))
            .catch((e) => {
              this.logger.error(
                `Error processing model ${model.fk_model_id}: ${e.message}`,
                e.stack,
              );
            });
        }
      }

      await queue.onIdle();

      await ncMeta.disableUpgraderMode();

      const [seconds] = process.hrtime(totalHrTime);
      this.log(`Migration job completed in ${seconds}s`);

      return true;
    } catch (error) {
      this.logger.error(`Migration failed: ${error.message}`, error.stack);
      await ncMeta.disableUpgraderMode();
      return false;
    }
  }

  private async addSoftDeleteColumn(
    model: Model,
    source: Source,
    sqlMgr: SqlMgrv2,
  ) {
    const newColumn = {
      ...(await memoizedGetColumnPropsFromUIDT(source)),
      column_name: getUniqueColumnName(model.columns, '__nc_deleted'),
      title: getUniqueColumnAliasName(model.columns, '__nc_deleted'),
      cdf: source.type === 'mysql2' ? '0' : 'false',
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
    ncMeta: Upgrader,
  ) {
    const { id: modelId, source_id, base_id } = modelData;
    const context = { workspace_id: modelData?.fk_workspace_id, base_id };

    const originalSource = await this.cache.get(source_id, async () =>
      Source.get(context, source_id),
    );

    if (!originalSource || !originalSource.isMeta()) {
      await this.updateModelStatus(Noco.ncMeta, modelId, true);
      return;
    }

    const source = new Source({
      ...originalSource,
      upgraderMode: true,
      upgraderQueries: [],
    });

    source.upgraderMode = true;

    const dbDriver: CustomKnex = await NcConnectionMgrv2.get(source);

    const model = await Model.get(context, modelId);

    const baseModel = await Model.getBaseModelSQL(context, {
      model,
      source,
      dbDriver,
    });

    await model.getColumns(context);

    const tnPath = baseModel.getTnPath(model.table_name);

    const sqlMgr = ProjectMgrv2.getSqlMgr(
      context,
      { id: source.base_id },
      ncMeta,
    );

    // Check if __nc_deleted column already exists
    const deletedColumn = model.columns.find((c) => isDeletedCol(c));

    if (!deletedColumn) {
      const newColumn = await this.addSoftDeleteColumn(model, source, sqlMgr);

      await Column.insert(
        context,
        {
          ...newColumn,
          system: true,
          fk_model_id: model.id,
          source_id,
        },
        ncMeta,
      );

      // Add index on __nc_deleted for fast filtering
      const realDbDriver = await NcConnectionMgrv2.get(
        new Source({
          ...source,
          upgraderMode: false,
        } as any),
      );

      const queries = source.upgraderQueries.splice(0);

      if (queries.length) {
        if (isEE) {
          await realDbDriver.raw(queries.join(';'));
        } else {
          const trans = await realDbDriver.transaction();
          try {
            for (const query of queries) {
              await trans.raw(query);
            }
            await trans.commit();
          } catch (e) {
            await trans.rollback();
            throw e;
          }
        }
      }

      // Add index separately
      try {
        await realDbDriver.schema.table(tnPath as string, (t) => {
          t.index(['__nc_deleted'], `${model.table_name}_nc_deleted_idx`);
        });
      } catch (_e) {
        // index may already exist, ignore
      }

      await ncMeta.runUpgraderQueries();
    } else {
      this.log(
        `__nc_deleted column already exists for model ${modelId}, Table: ${model.table_name}`,
      );
    }

    await this.updateModelStatus(Noco.ncMeta, modelId, true);
  }

  private getModelsQuery(ncMeta: MetaService) {
    return ncMeta
      .knexConnection(MetaTable.MODELS)
      .select([
        `${MetaTable.MODELS}.id`,
        'source_id',
        `${MetaTable.MODELS}.base_id`,
        ...(isEE ? [`${MetaTable.MODELS}.fk_workspace_id`] : []),
      ])
      .where(`${MetaTable.MODELS}.mm`, false)
      .join(
        MetaTable.SOURCES,
        `${MetaTable.MODELS}.source_id`,
        '=',
        `${MetaTable.SOURCES}.id`,
      )
      .where((builder) => {
        builder.where(`${MetaTable.SOURCES}.is_meta`, true);
        builder.orWhere({ is_local: true });
      })
      .whereNotIn(
        `${MetaTable.MODELS}.id`,
        ncMeta.knexConnection(TEMP_TABLE).select('fk_model_id'),
      )
      .whereNotIn(
        `${MetaTable.MODELS}.id`,
        this.processingModels.map((m) => m.fk_model_id),
      )
      .orderBy(`${MetaTable.MODELS}.source_id`)
      .limit(PARALLEL_LIMIT * 10);
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
}
