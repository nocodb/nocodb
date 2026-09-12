import { Injectable } from '@nestjs/common';
import { isDeletedCol } from 'nocodb-sdk';
import type CustomKnex from '~/db/CustomKnex';
import type { MetaService } from '~/meta/meta.service';
import { Column, Model, Source } from '~/models';
import { MetaTable } from '~/utils/globals';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';
import SimpleLRUCache from '~/utils/cache';
import Noco from '~/Noco';
import Upgrader from '~/Upgrader';
import ProjectMgrv2 from '~/db/sql-mgr/v2/ProjectMgrv2';
import { Altered } from '~/services/columns.service';

const PARALLEL_LIMIT =
  +process.env.NC_NORMALIZE_SOFT_DELETE_MIGRATION_PARALLEL_LIMIT || 10;

const TEMP_TABLE = 'nc_temp_processed_normalize_soft_delete';

/**
 * Migration 011 — backfill fix for the soft-delete column added in job 010.
 *
 * Job 010 added `__nc_deleted BOOLEAN DEFAULT 'false'` for non-MySQL sources.
 * SQLite has no native boolean: the string literal `'false'` is stored verbatim
 * on every existing row. The soft-delete filter compares against integer 0, so
 * every row is treated as deleted and the UI renders empty tables.
 *
 * Job 010 is now fixed to use `'0'` as the default for SQLite, so new
 * deployments won't hit this. Existing affected installs need this one-time
 * pass to:
 *   - rewrite the physical column's DDL default from 'false' to '0' via
 *     sqlMgr.sqlOpPlus('tableUpdate') + Altered.UPDATE_COLUMN — queued
 *     through upgrader mode and flushed in a single transaction, matching
 *     job 010's pattern.
 *   - normalize surviving row values ('false' → 0, 'true' → 1) AFTER the
 *     DDL rewrite: SqliteClient's change-column dance copies the old column
 *     into the new one (`UPDATE new = old`), so any normalization done
 *     beforehand would be overwritten by the copy.
 *   - update the `nc_columns_v2.cdf` so the NocoDB column definition records
 *     the numeric default going forward.
 *
 * Progress is tracked per-model in {@link TEMP_TABLE} so interrupted runs can
 * resume without redoing work. No-op for non-SQLite meta sources.
 */
@Injectable()
export class NormalizeSoftDeleteSqliteMigration {
  private processingModels: {
    fk_model_id: string;
    processing: boolean;
  }[] = [{ fk_model_id: 'placeholder', processing: true }];
  private processedModelsCount = 0;
  private cache = new SimpleLRUCache(1000);

  constructor() {}

  log = (...msgs: string[]) => {
    console.log('[nc_job_011_normalize_soft_delete_sqlite]: ', ...msgs);
  };

  getModelsToBeProcessedQueryBuilder(ncMeta: Upgrader) {
    return ncMeta
      .knexConnection(MetaTable.MODELS)
      .join(
        MetaTable.SOURCES,
        `${MetaTable.MODELS}.source_id`,
        '=',
        `${MetaTable.SOURCES}.id`,
      )
      .where(`${MetaTable.MODELS}.mm`, false)
      .where(`${MetaTable.SOURCES}.type`, 'sqlite3')
      .where((builder) => {
        builder.where(`${MetaTable.SOURCES}.is_meta`, true);
        builder.orWhere(`${MetaTable.SOURCES}.is_local`, true);
      })
      .whereNotExists((qb) =>
        qb
          .select(1)
          .from(TEMP_TABLE)
          .whereRaw(`${TEMP_TABLE}.fk_model_id = ${MetaTable.MODELS}.id`),
      );
  }

  async job() {
    // Create progress tracking table if it doesn't exist.
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

    // Remove incomplete models from previous run so they get retried.
    await Noco.ncMeta
      .knexConnection(TEMP_TABLE)
      .delete()
      .where('completed', false);

    this.processingModels = [{ fk_model_id: '__sentinel__', processing: true }];
    this.processedModelsCount = 0;
    this.cache.clear();

    const ncMeta = new Upgrader();

    try {
      ncMeta.enableUpgraderMode();

      const numberOfModelsToBeProcessed = +(
        await this.getModelsToBeProcessedQueryBuilder(ncMeta)
          .count('*', { as: 'count' })
          .first()
      )?.count;

      this.log(`Total models to be processed: ${numberOfModelsToBeProcessed}`);

      if (!numberOfModelsToBeProcessed) {
        return true;
      }

      // SQLite in scope → force serial; otherwise use PARALLEL_LIMIT.
      const hasSqlite = !!(await ncMeta
        .knexConnection(MetaTable.SOURCES)
        .where('type', 'sqlite3')
        .where((b) => b.where('is_meta', true).orWhere({ is_local: true }))
        .first());
      const concurrency = hasSqlite ? 1 : PARALLEL_LIMIT;
      this.log(`Concurrency: ${concurrency}`);

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const modelsToProcess = await this.getModelsToBeProcessedQueryBuilder(
          ncMeta,
        )
          .select([
            `${MetaTable.MODELS}.id`,
            `${MetaTable.MODELS}.source_id`,
            `${MetaTable.MODELS}.table_name`,
            `${MetaTable.MODELS}.base_id`,
            `${MetaTable.MODELS}.fk_workspace_id`,
          ])
          .whereNotIn(
            `${MetaTable.MODELS}.id`,
            this.processingModels.map((m) => m.fk_model_id),
          )
          .orderBy(`${MetaTable.MODELS}.id`, 'asc')
          .limit(concurrency * 2);

        if (!modelsToProcess?.length) break;

        for (const model of modelsToProcess) {
          this.processingModels.push({
            fk_model_id: model.id,
            processing: true,
          });
          try {
            await this.processModel(model, ncMeta);
            await this.updateModelStatus(Noco.ncMeta, model.id, true);
          } catch (ex) {
            this.log(`Error processing model ${model.id}:`, ex.message);
            await this.updateModelStatus(
              Noco.ncMeta,
              model.id,
              false,
              ex.message,
            );
          }
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      this.log(
        `Migration completed. Processed ${this.processedModelsCount} models`,
      );

      return true;
    } catch (error) {
      this.log('Migration failed:', error?.message);
      return false;
    } finally {
      await ncMeta.disableUpgraderMode();
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
    const { id: modelId, source_id, base_id } = modelData;
    const context = { workspace_id: modelData?.fk_workspace_id, base_id };

    const originalSource = await this.cache.get(source_id, async () =>
      Source.get(context, source_id),
    );

    if (!originalSource?.isMeta() || originalSource.type !== 'sqlite3') {
      return;
    }

    const source = new Source({
      ...originalSource,
      upgraderMode: true,
      upgraderQueries: [],
    });
    source.upgraderMode = true;

    const dbDriver: CustomKnex = await NcConnectionMgrv2.get(source);

    const model: any = {
      id: modelId,
      source_id: modelData.source_id,
      base_id: modelData.base_id,
      fk_workspace_id: modelData.fk_workspace_id,
      table_name: modelData.table_name,
      columns: [] as Column[],
    };

    const baseModel = await Model.getBaseModelSQL(context, {
      model,
      source,
      dbDriver,
    });

    // Load all columns for the model — sqlMgr.tableUpdate rewrites the
    // whole table, so it must see every existing column verbatim.
    const columnRows = await ncMeta
      .knexConnection(MetaTable.COLUMNS)
      .where('fk_workspace_id', context.workspace_id)
      .where('base_id', context.base_id)
      .where('fk_model_id', model.id)
      .select('*');
    model.columns = columnRows.map((c: any) => {
      if (c.meta && typeof c.meta === 'string') {
        try {
          c.meta = JSON.parse(c.meta);
        } catch {
          /* leave as-is */
        }
      }
      return new Column(c);
    });

    const deletedCol = model.columns.find((c) => isDeletedCol(c));
    if (!deletedCol) return;
    if (deletedCol.cdf === '0') return;

    const tnPath = baseModel.getTnPath(model.table_name);

    // Queue the DDL alter through upgrader mode. sqlMgr.sqlOpPlus →
    // SqliteClient.alterTableColumn(change=2) emits the rename / add-new /
    // copy / drop dance; the new column picks up DEFAULT '0'.
    const sqlMgr = ProjectMgrv2.getSqlMgr(
      context,
      { id: source.base_id },
      ncMeta,
    );

    const originalColumns = model.columns.map((c) => ({
      ...c,
      cn: c.column_name,
      cno: c.column_name,
    }));

    const columns = model.columns.map((c) => {
      const base = { ...c, cn: c.column_name, cno: c.column_name };
      if (c.id === deletedCol.id) {
        return { ...base, cdf: '0', altered: Altered.UPDATE_COLUMN };
      }
      return base;
    });

    // Job 010 creates `nc_deleted_idx_${model.id}` on `__nc_deleted` (see
    // nc_job_010_soft_delete_column.ts:438-447). SqliteClient's rename/add/
    // copy/drop alter dance renames the original column to a backup name;
    // the index follows the rename, and SQLite refuses to DROP COLUMN on a
    // column still referenced by an index. Drop the index first, recreate
    // it on the new column after the alter.
    const realDbDriver = await NcConnectionMgrv2.get(
      new Source({ ...originalSource, upgraderMode: false } as any),
    );
    const indexName = `nc_deleted_idx_${model.id}`;

    await realDbDriver.raw('DROP INDEX IF EXISTS ??', [indexName]);

    await sqlMgr.sqlOpPlus(source, 'tableUpdate', {
      ...model,
      tn: model.table_name,
      originalColumns,
      columns,
    });

    await Upgrader.flushSourceQueries(source, realDbDriver);

    await realDbDriver.raw('CREATE INDEX IF NOT EXISTS ?? ON ?? (??)', [
      indexName,
      model.table_name,
      deletedCol.column_name,
    ]);

    await realDbDriver(tnPath)
      .update({ [deletedCol.column_name]: 0 })
      .where(deletedCol.column_name, 'false');
    await realDbDriver(tnPath)
      .update({ [deletedCol.column_name]: 1 })
      .where(deletedCol.column_name, 'true');

    // Sync the meta column's cdf so the NocoDB column definition records
    // '0' going forward.
    await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.COLUMNS,
      { cdf: '0' },
      deletedCol.id,
    );

    await ncMeta.runUpgraderQueries();

    this.processedModelsCount++;
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
