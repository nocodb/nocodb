import { Injectable, Logger } from '@nestjs/common';
import debug from 'debug';
import PQueue from 'p-queue';
import { isDeletedCol, UITypes } from 'nocodb-sdk';
import type CustomKnex from '~/db/CustomKnex';
import { Model, Source } from '~/models';
import { MetaTable } from '~/utils/globals';
import SimpleLRUCache from '~/utils/cache';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';
import Noco from '~/Noco';

/**
 * Backfill `nc_trash` with one record-type entry per pre-existing
 * soft-delete event. Soft-delete events that pre-date the unified BaseTrash
 * registry have rows on the data table flagged `__nc_deleted = true` but no
 * matching metadata row in `nc_trash`. Without this backfill those entries
 * would only ever be cleaned up by the retention cron — they'd never appear
 * in the unified trash UI.
 *
 * Strategy (per meta-source, EE-only model):
 *   1. SELECT DISTINCT (LMB, LMT) FROM table WHERE __nc_deleted = true
 *   2. For each tuple, build the canonical `${tableId}:${userId}::${lmtIso}`
 *      resource_id and INSERT INTO nc_trash if absent (composite-PK unique
 *      check via metaInsert2's natural id-gen + a pre-INSERT existence
 *      probe).
 *   3. cleanup_due_at is computed from the original `deleted_at` (not now!)
 *      so backfilled rows that have been sitting in soft-delete past
 *      retention purge on the next cleanup tick instead of getting fresh
 *      windows.
 *
 * Resumable across restarts via `nc_temp_processed_record_trash_backfill`.
 * Each model is marked complete (or failed with the error) in the temp
 * table; restarting the job picks up where it left off.
 *
 * No-op on CE (no `nc_trash` table) and on models without LMT (record trash
 * keys off LMT — without it, entries can't be reconstructed).
 */

const PARALLEL_LIMIT =
  +process.env.NC_RECORD_TRASH_BACKFILL_PARALLEL_LIMIT || 10;
// TODO: Drop after migration is confirmed complete across all deployments
const TEMP_TABLE = 'nc_temp_processed_record_trash_backfill';
// Page size for the per-model tuple scan. DISTINCT (lmt, lmb) reduces a
// soft-deleted row count to one row per delete event, so 100 events per
// page is enough to keep memory bounded even on tables with many events.
const TUPLE_BATCH_SIZE = 100;
const encodeEventId = (
  fkUserId: string | null | undefined,
  deletedAtIso: string,
) => `${fkUserId ?? ''}::${deletedAtIso}`;

@Injectable()
export class RecordTrashBackfillMigration {
  private readonly debugLog = debug('nc:migration-jobs:record-trash-backfill');
  private readonly logger = new Logger(RecordTrashBackfillMigration.name);
  private readonly log = (...msgs: string[]) =>
    this.logger.log(`${msgs.join(' ')}`);

  private processingModels = [
    { fk_model_id: '__sentinel__', processing: true },
  ];
  private processedModelsCount = 0;
  private cache = new SimpleLRUCache(1000);

  async job() {
    const ncMeta = Noco.ncMeta;
    if (!(await ncMeta.knexConnection.schema.hasTable(TEMP_TABLE))) {
      await ncMeta.knexConnection.schema.createTable(TEMP_TABLE, (table) => {
        table.increments('id').primary();
        table.string('fk_model_id').notNullable();
        table.boolean('completed').defaultTo(false);
        table.text('error').nullable();
        table.index('fk_model_id');
      });
    }

    await ncMeta.knexConnection(TEMP_TABLE).delete().where('completed', false);

    this.processingModels = [{ fk_model_id: '__sentinel__', processing: true }];
    this.processedModelsCount = 0;
    this.cache.clear();

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
          .where((b) => {
            b.where(`${MetaTable.SOURCES}.is_meta`, true);
            b.orWhere({ is_local: true });
          })
          .whereNotExists((qb) =>
            qb
              .select(1)
              .from(TEMP_TABLE)
              .whereRaw(`${TEMP_TABLE}.fk_model_id = ${MetaTable.MODELS}.id`),
          )
          .count('*', { as: 'count' })
          .first()
      )?.count;

      this.log(
        `Found ${numberOfModelsToBeProcessed} models to scan for soft-deleted records`,
      );

      // SQLite forces serial; otherwise PARALLEL_LIMIT.
      const hasSqlite = !!(await ncMeta
        .knexConnection(MetaTable.SOURCES)
        .where('type', 'sqlite3')
        .where((b) => b.where('is_meta', true).orWhere({ is_local: true }))
        .first());
      const concurrency = hasSqlite ? 1 : PARALLEL_LIMIT;
      this.log(`Concurrency: ${concurrency}`);

      const wrapper = async (modelData: {
        id: string;
        source_id: string;
        fk_workspace_id?: string;
        base_id: string;
        table_name: string;
        title: string;
        trash_disabled?: boolean | null;
        trash_retention_days?: number | null;
      }) => {
        try {
          await this.processModel(modelData);
        } catch (e) {
          this.logger.error(
            `Error processing model ${modelData.id}: ${e.message}`,
            e.stack,
          );
          await this.markProcessed(modelData.id, false, e.message);
        } finally {
          const item = this.processingModels.find(
            (m) => m.fk_model_id === modelData.id,
          );
          if (item) item.processing = false;

          this.processedModelsCount++;
          this.log(
            `Processed ${this.processedModelsCount} of ${numberOfModelsToBeProcessed} models`,
          );
        }
      };

      const queue = new PQueue({ concurrency });

      // eslint-disable-next-line no-constant-condition
      while (true) {
        if (queue.size > concurrency * 2) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          continue;
        }

        this.processingModels = this.processingModels.filter(
          (m) => m.processing,
        );

        const models = await this.getModelsQuery(concurrency);
        if (!models?.length) break;

        for (const m of models) {
          this.processingModels.push({ fk_model_id: m.id, processing: true });
          queue
            .add(() => wrapper(m))
            .catch((e) => {
              this.logger.error(
                `Error processing model ${m.id}: ${e.message}`,
                e.stack,
              );
            });
        }
      }

      await queue.onIdle();

      const [seconds] = process.hrtime(totalHrTime);
      this.log(`Migration job completed in ${seconds}s`);
      return true;
    } catch (error) {
      this.logger.error(`Migration failed: ${error.message}`, error.stack);
      return false;
    }
  }

  private async processModel(modelData: {
    id: string;
    source_id: string;
    fk_workspace_id?: string;
    base_id: string;
    table_name: string;
    title: string;
    trash_disabled?: boolean | null;
    trash_retention_days?: number | null;
  }) {
    const {
      id: modelId,
      source_id,
      base_id,
      fk_workspace_id,
      table_name,
      title,
      trash_disabled,
      trash_retention_days,
    } = modelData;
    const context = { workspace_id: fk_workspace_id, base_id };

    if (trash_disabled) {
      await this.markProcessed(modelId, true);
      return;
    }

    const source = await this.cache.get(source_id, async () =>
      Source.get(context, source_id),
    );
    if (!source || !source.isMeta()) {
      await this.markProcessed(modelId, true);
      return;
    }

    const ncMeta = Noco.ncMeta;

    // Skip Model.get + model.getColumns — getModelsQuery already pre-fetched
    // the model fields, and getColumns does N+1 fetches for col options
    // (LTAR / Lookup / Select) that we don't need here. A bare SELECT for
    // the three system columns we care about is enough.
    const colRows = await ncMeta
      .knexConnection(MetaTable.COLUMNS)
      .where('fk_workspace_id', context.workspace_id)
      .where('base_id', context.base_id)
      .where('fk_model_id', modelId)
      .whereIn('uidt', [
        UITypes.LastModifiedTime,
        UITypes.LastModifiedBy,
        UITypes.Deleted,
      ])
      .select('column_name', 'uidt', 'system');

    const deletedColumn = colRows.find((c: any) => isDeletedCol(c));
    const lmtCol = colRows.find(
      (c: any) => c.uidt === UITypes.LastModifiedTime && c.system,
    );
    const lmbCol = colRows.find(
      (c: any) => c.uidt === UITypes.LastModifiedBy && c.system,
    );
    if (!deletedColumn || !lmtCol) {
      await this.markProcessed(modelId, true);
      return;
    }

    const dbDriver: CustomKnex = await NcConnectionMgrv2.get(source);

    const model = new Model({
      id: modelId,
      source_id,
      base_id,
      fk_workspace_id,
      table_name,
      title,
    });

    const baseModel = await Model.getBaseModelSQL(context, {
      model,
      dbDriver,
      source,
    });

    const distinctCols = lmbCol
      ? [lmtCol.column_name, lmbCol.column_name]
      : [lmtCol.column_name];

    const retentionDays = await this.resolveRetentionDays(
      fk_workspace_id,
      trash_retention_days,
    );

    let inserted = 0;
    let offset = 0;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const tuples = await baseModel
        .dbDriver(baseModel.tnPath)
        .where(deletedColumn.column_name, true)
        .distinct(...distinctCols)
        .orderBy(lmtCol.column_name, 'asc')
        .limit(TUPLE_BATCH_SIZE)
        .offset(offset);

      if (!tuples.length) break;

      // Build all rows first, then ONE bulk INSERT per page with
      // ON CONFLICT DO NOTHING — collapses 2N round-trips (existence probe
      // + insert) into a single statement. The unique constraint
      // (base_id, resource_type, resource_id) on `nc_trash` is the natural
      // dedup key; conflicts are silently ignored, matching the runtime
      // listener's idempotent behaviour.
      const rowsToInsert: Record<string, any>[] = [];
      for (const t of tuples) {
        const lmtVal = t[lmtCol.column_name];
        if (lmtVal == null) continue;
        const deletedAtIso =
          lmtVal instanceof Date
            ? lmtVal.toISOString()
            : new Date(lmtVal).toISOString();
        const fkUserId = lmbCol ? t[lmbCol.column_name] ?? null : null;
        const resourceId = `${modelId}:${encodeEventId(
          fkUserId,
          deletedAtIso,
        )}`;
        const cleanupDueAt = new Date(deletedAtIso);
        cleanupDueAt.setUTCDate(cleanupDueAt.getUTCDate() + retentionDays);

        rowsToInsert.push({
          id: await ncMeta.genNanoid(MetaTable.TRASH),
          fk_workspace_id: fk_workspace_id ?? null,
          base_id,
          resource_type: 'record',
          resource_id: resourceId,
          name: title,
          parent_type: 'table',
          parent_id: modelId,
          parent_name: title,
          deleted_by: fkUserId,
          deleted_at: deletedAtIso,
          cleanup_due_at: cleanupDueAt.toISOString(),
        });
      }

      if (rowsToInsert.length) {
        const result = await ncMeta
          .knexConnection(MetaTable.TRASH)
          .insert(rowsToInsert)
          .onConflict(['base_id', 'resource_type', 'resource_id'])
          .ignore();
        // pg returns the count of inserted rows; mysql/sqlite return an
        // array of affected ids. Treat anything truthy as "some inserted"
        // and use rowsToInsert.length as the upper bound for telemetry.
        inserted +=
          typeof result === 'number'
            ? result
            : Array.isArray(result)
            ? result.length
            : rowsToInsert.length;
      }

      if (tuples.length < TUPLE_BATCH_SIZE) break;
      offset += tuples.length;
    }

    if (inserted > 0) {
      this.log(
        `Backfilled ${inserted} record trash entries for model ${modelId}`,
      );
    }

    await this.markProcessed(modelId, true);
  }

  protected async resolveRetentionDays(
    _workspaceId: string | undefined,
    perTableOverride: number | null | undefined,
  ): Promise<number> {
    if (typeof perTableOverride === 'number' && perTableOverride > 0) {
      return perTableOverride;
    }
    const envVal = parseInt(process.env.NC_TRASH_RETENTION_DAYS || '30', 10);
    return Number.isFinite(envVal) && envVal > 0 ? envVal : 30;
  }

  private getModelsQuery(concurrency: number) {
    return Noco.ncMeta
      .knexConnection(MetaTable.MODELS)
      .select([
        `${MetaTable.MODELS}.id`,
        'source_id',
        `${MetaTable.MODELS}.base_id`,
        `${MetaTable.MODELS}.fk_workspace_id`,
        `${MetaTable.MODELS}.table_name`,
        `${MetaTable.MODELS}.title`,
        `${MetaTable.MODELS}.trash_disabled`,
        `${MetaTable.MODELS}.trash_retention_days`,
      ])
      .where(`${MetaTable.MODELS}.mm`, false)
      .join(
        MetaTable.SOURCES,
        `${MetaTable.MODELS}.source_id`,
        '=',
        `${MetaTable.SOURCES}.id`,
      )
      .where((b) => {
        b.where(`${MetaTable.SOURCES}.is_meta`, true);
        b.orWhere({ is_local: true });
      })
      .whereNotExists((qb) =>
        qb
          .select(1)
          .from(TEMP_TABLE)
          .whereRaw(`${TEMP_TABLE}.fk_model_id = ${MetaTable.MODELS}.id`),
      )
      .whereNotIn(
        `${MetaTable.MODELS}.id`,
        this.processingModels.map((m) => m.fk_model_id),
      )
      .limit(concurrency * 10);
  }

  private async markProcessed(
    modelId: string,
    completed: boolean,
    error?: string,
  ) {
    await Noco.ncMeta
      .knexConnection(TEMP_TABLE)
      .insert({ fk_model_id: modelId, completed, error });
  }
}
