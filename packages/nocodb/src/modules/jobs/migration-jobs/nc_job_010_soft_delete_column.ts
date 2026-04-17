import { Injectable, Logger } from '@nestjs/common';
import debug from 'debug';
import PQueue from 'p-queue';
import { isDeletedCol, UITypes } from 'nocodb-sdk';
import type { MetaService } from '~/meta/meta.service';
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
import { META_COL_NAME } from '~/constants';

const PARALLEL_LIMIT =
  +process.env.NC_SOFT_DELETE_MIGRATION_PARALLEL_LIMIT || 10;
// TODO: Drop nc_temp_processed_soft_delete after migration is confirmed complete across all deployments
const TEMP_TABLE = 'nc_temp_processed_soft_delete';

// Comma-separated workspace IDs to target during dry-run.
// When set, the migration only processes models in these workspaces.
const TARGET_WORKSPACE_IDS = process.env.NC_TRASH_MIGRATION_WORKSPACE_IDS
  ? process.env.NC_TRASH_MIGRATION_WORKSPACE_IDS.split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  : null;

const propsByClientType = {};

const memoizedGetColumnPropsFromUIDT = async (
  source: Source,
  uidt: UITypes,
  column_name: string,
) => {
  const cacheKey = `${source.type}:${uidt}`;

  if (!propsByClientType[cacheKey]) {
    propsByClientType[cacheKey] = await getColumnPropsFromUIDT(
      {
        uidt,
        column_name,
        title: column_name,
      },
      source,
    );
  }

  return propsByClientType[cacheKey];
};

@Injectable()
export class SoftDeleteColumnMigration {
  private readonly debugLog = debug('nc:migration-jobs:soft-delete-column');
  private readonly logger = new Logger(SoftDeleteColumnMigration.name);
  private readonly log = (...msgs: string[]) =>
    this.logger.log(`${msgs.join(' ')}`);

  private processingModels = [
    { fk_model_id: '__sentinel__', processing: true },
  ];
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
    this.processingModels = [{ fk_model_id: '__sentinel__', processing: true }];
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
          .modify((qb) => {
            if (TARGET_WORKSPACE_IDS) {
              qb.whereIn(
                `${MetaTable.MODELS}.fk_workspace_id`,
                TARGET_WORKSPACE_IDS,
              );
            }
          })
          .count('*', { as: 'count' })
          .first()
      )?.count;

      if (TARGET_WORKSPACE_IDS) {
        this.log(
          `Dry-run mode: targeting ${
            TARGET_WORKSPACE_IDS.length
          } workspace(s): ${TARGET_WORKSPACE_IDS.join(', ')}`,
        );
      }

      this.log(
        `Found ${numberOfModelsToBeProcessed} models to process for soft delete + meta column`,
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

    const v1OoFkColIds = new Set<string>();
    for (const col of model.columns) {
      if (col.uidt !== UITypes.LinkToAnotherRecord) continue;
      const colOpts = await col.getColOptions<any>(context, ncMeta);
      if (colOpts?.type !== 'oo' || !col.meta?.bt) continue;
      if (colOpts?.version === 2) continue;
      const fkCol = await Column.get(
        context,
        { colId: colOpts.fk_child_column_id },
        ncMeta,
      );
      if (!fkCol || fkCol.fk_model_id !== model.id || !fkCol.unique) continue;
      v1OoFkColIds.add(fkCol.id);
    }

    const needsDeletedCol = !model.columns.find((c) => isDeletedCol(c));
    const needsMetaCol =
      isEE &&
      source.type === 'pg' &&
      !model.columns.find((c) => c.uidt === UITypes.Meta);
    const needsOoUniqueDrop = v1OoFkColIds.size > 0;

    // Check if any user-set unique columns need to be converted to partial unique indexes.
    // This handles tables that already have __nc_deleted but still have regular unique constraints.
    // Exclude PK and auto-increment columns — their unique constraints must stay unconditional.
    const hasUniqueColumns = model.columns.some(
      (c) => c.unique && !v1OoFkColIds.has(c.id) && !c.pk && !c.ai,
    );
    const needsUniqueConversion = hasUniqueColumns && !needsDeletedCol;

    if (
      !needsDeletedCol &&
      !needsMetaCol &&
      !needsOoUniqueDrop &&
      !needsUniqueConversion
    ) {
      await this.updateModelStatus(Noco.ncMeta, modelId, true);
      return;
    }

    let newDeletedColumn: any;
    let newMetaColumn: any;

    // For columns whose unique constraint needs to be recreated as a partial index,
    // set unique: false on the original so PgClient sees a false→true transition.
    // Exclude PK and auto-increment columns — their unique constraints must stay unconditional.
    const needsUniqueRecreate = (c: Column) =>
      (needsDeletedCol || needsUniqueConversion) &&
      c.unique &&
      !v1OoFkColIds.has(c.id) &&
      !c.pk &&
      !c.ai;

    const originalColumns = model.columns.map((c) => ({
      ...c,
      cn: c.column_name,
      ...(needsUniqueRecreate(c) ? { unique: false } : {}),
    }));

    const columns = model.columns.map((c) => ({
      ...c,
      cn: c.column_name,
      ...(v1OoFkColIds.has(c.id)
        ? { altered: Altered.UPDATE_COLUMN, unique: false }
        : // Re-process existing unique columns so PgClient recreates them as
        // partial unique indexes that exclude soft-deleted rows
        needsUniqueRecreate(c)
        ? { altered: Altered.UPDATE_COLUMN }
        : {}),
    }));

    if (needsDeletedCol) {
      newDeletedColumn = {
        ...(await memoizedGetColumnPropsFromUIDT(
          source,
          UITypes.Deleted,
          '__nc_deleted',
        )),
        column_name: getUniqueColumnName(model.columns, '__nc_deleted'),
        title: getUniqueColumnAliasName(model.columns, '__nc_deleted'),
        cdf: source.type === 'mysql2' ? '0' : 'false',
        system: true,
        altered: Altered.NEW_COLUMN,
      };
      columns.push({ ...newDeletedColumn, cn: newDeletedColumn.column_name });
    }

    if (needsMetaCol) {
      newMetaColumn = {
        ...(await memoizedGetColumnPropsFromUIDT(
          source,
          UITypes.Meta,
          META_COL_NAME,
        )),
        column_name: getUniqueColumnName(model.columns, META_COL_NAME),
        title: getUniqueColumnAliasName(model.columns, META_COL_NAME),
        system: true,
        altered: Altered.NEW_COLUMN,
      };
      columns.push({ ...newMetaColumn, cn: newMetaColumn.column_name });
    }
    await sqlMgr.sqlOpPlus(source, 'tableUpdate', {
      ...model,
      tn: model.table_name,
      originalColumns,
      columns,
    });

    if (needsDeletedCol && newDeletedColumn) {
      const idxName = `${model.table_name}_nc_deleted_idx`.slice(0, 63);
      source.upgraderQueries.push(
        dbDriver
          .raw(`CREATE INDEX ?? ON ?? (??)`, [
            idxName,
            tnPath,
            newDeletedColumn.column_name,
          ])
          .toQuery(),
      );
    }

    const realDbDriver = await NcConnectionMgrv2.get(
      new Source({ ...originalSource, upgraderMode: false } as any),
    );

    await Upgrader.flushSourceQueries(source, realDbDriver);
    if (needsDeletedCol && newDeletedColumn) {
      await Column.insert(
        context,
        { ...newDeletedColumn, system: true, fk_model_id: model.id, source_id },
        ncMeta,
      );
    }

    if (needsMetaCol && newMetaColumn) {
      await Column.insert(
        context,
        { ...newMetaColumn, system: true, fk_model_id: model.id, source_id },
        ncMeta,
      );
    }

    for (const fkColId of v1OoFkColIds) {
      await Column.update(context, fkColId, { unique: false }, ncMeta);
    }

    await ncMeta.runUpgraderQueries();

    await this.updateModelStatus(Noco.ncMeta, modelId, true);
  }

  private getModelsQuery(ncMeta: MetaService) {
    return ncMeta
      .knexConnection(MetaTable.MODELS)
      .select([
        `${MetaTable.MODELS}.id`,
        'source_id',
        `${MetaTable.MODELS}.base_id`,
        `${MetaTable.MODELS}.fk_workspace_id`,
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
      .modify((qb) => {
        if (TARGET_WORKSPACE_IDS) {
          qb.whereIn(
            `${MetaTable.MODELS}.fk_workspace_id`,
            TARGET_WORKSPACE_IDS,
          );
        }
      })
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
