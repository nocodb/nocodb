import { randomUUID } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import {
  isDeletedCol,
  NOCO_SERVICE_USERS,
  ServiceUserType,
  UITypes,
} from 'nocodb-sdk';
import type { NcRequest } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import { MetaTable } from '~/utils/globals';
import Noco from '~/Noco';
import { Model, Source } from '~/models';
import { getCompositePkValue } from '~/helpers/dbHelpers';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';
import { resolveTrashRetentionDays } from '~/helpers/trashHelpers';
import { acquireLock, releaseLock } from '~/helpers/lockHelpers';

const BATCH_SIZE = 100;
const MAX_TABLES_PER_RUN = 50;
const LOCK_KEY = 'lock:record-trash-cleanup';
// Just under the cron interval (10m). If a run legitimately exceeds this,
// the lock expires and the next tick can take over.
const LOCK_TTL_SECONDS = 9 * 60;

@Injectable()
export class RecordTrashCleanupJob {
  private readonly logger = new Logger(RecordTrashCleanupJob.name);

  async job() {
    // Skip this tick if another instance is already running. With shared
    // queue concurrency, a long cleanup could overlap with the next cron
    // fire and re-process the same tables.
    const lockId = randomUUID();
    const gotLock = await acquireLock(LOCK_KEY, lockId, 0, LOCK_TTL_SECONDS);
    if (!gotLock) {
      this.logger.log('Skipping — another cleanup run is active');
      return { totalDeleted: 0, tablesProcessed: 0 };
    }

    try {
      return await this.runCleanup();
    } finally {
      await releaseLock(LOCK_KEY, lockId);
    }
  }

  private async runCleanup() {
    const now = new Date();

    // Query models with due cleanup — ordered by earliest due first
    const modelsWithDueCleanup = await Noco.ncMeta
      .knexConnection(MetaTable.MODELS)
      .whereNotNull('trash_cleanup_due_at')
      .where('trash_cleanup_due_at', '<=', now.toISOString())
      .orderBy('trash_cleanup_due_at', 'asc')
      .limit(MAX_TABLES_PER_RUN)
      .select('id', 'base_id', 'source_id', 'fk_workspace_id');

    if (!modelsWithDueCleanup.length)
      return { totalDeleted: 0, tablesProcessed: 0 };

    let totalDeleted = 0;
    let tablesProcessed = 0;

    for (const modelRow of modelsWithDueCleanup) {
      try {
        const context: NcContext = {
          workspace_id: modelRow.fk_workspace_id,
          base_id: modelRow.base_id,
        };

        const model = await Model.get(context, modelRow.id);
        if (!model) continue;

        // Skip if trash is disabled for this model — clear schedule
        if (!model.isTrashEnabled) {
          await Model.updateTrashCleanupDueAt(context, model.id, null);
          continue;
        }

        // Skip if source or base no longer exists / is deleted
        const source = await Source.get(context, model.source_id);
        if (!source || !source.isMeta()) {
          await Model.updateTrashCleanupDueAt(context, model.id, null);
          continue;
        }

        await model.getColumns(context);

        // Check if __nc_deleted column exists
        const deletedColumn = model.columns.find((c) => isDeletedCol(c));

        if (!deletedColumn) {
          // Table doesn't have soft-delete support — clear schedule
          await Model.updateTrashCleanupDueAt(context, model.id, null);
          continue;
        }

        // Check if LastModifiedTime column exists for date comparison
        const lmtColumn = model.columns.find(
          (c) => c.uidt === UITypes.LastModifiedTime && c.system,
        );

        if (!lmtColumn) {
          this.logger.warn(
            `Table ${model.title} (${model.id}) has no LastModifiedTime column — skipping cleanup`,
          );
          await Model.updateTrashCleanupDueAt(context, model.id, null);
          continue;
        }

        // Resolve retention: per-model override → plan-based → env default
        const retentionDays =
          model.trash_retention_days ??
          (await resolveTrashRetentionDays(context));
        const cutoffDate = new Date(
          now.getTime() - retentionDays * 24 * 60 * 60 * 1000,
        );

        const dbDriver = await NcConnectionMgrv2.get(source);
        const baseModel = await Model.getBaseModelSQL(context, {
          model,
          source,
          dbDriver,
        });

        if (!model.primaryKeys?.length) {
          this.logger.warn(
            `Table ${model.title} (${model.id}) has no primary key — skipping cleanup`,
          );
          await Model.updateTrashCleanupDueAt(context, model.id, null);
          continue;
        }

        const pkColumns = model.primaryKeys.map((pk) => pk.column_name);

        // Format UTC wall-clock string to match how baseModel.now() stores
        // timestamps (columns are `timestamp without time zone`, bare UTC).
        const cutoffLmt = cutoffDate
          .toISOString()
          .replace('T', ' ')
          .replace('Z', '');

        const systemReq = {
          context,
          user: NOCO_SERVICE_USERS[ServiceUserType.TRASH_CLEANUP_USER],
        } as NcRequest;

        // Batch delete expired soft-deleted records
        let deletedInModel = 0;

        // eslint-disable-next-line no-constant-condition
        while (true) {
          const rows = await baseModel.execAndParse(
            baseModel
              .dbDriver(baseModel.tnPath)
              .select(pkColumns)
              .where(deletedColumn.column_name, true)
              .where(lmtColumn.column_name, '<', cutoffLmt)
              .limit(BATCH_SIZE),
            null,
            { raw: true },
          );

          if (!rows.length) break;

          const rowIds = rows.map((r) =>
            getCompositePkValue(model.primaryKeys, r),
          );

          await baseModel.permanentDeleteByIds(rowIds, systemReq, true);

          deletedInModel += rowIds.length;
          totalDeleted += rowIds.length;

          if (rowIds.length < BATCH_SIZE) break;
        }

        // Determine next trash_cleanup_due_at based on remaining trash
        const remainingTrash = await baseModel.execAndParse(
          baseModel
            .dbDriver(baseModel.tnPath)
            .where(deletedColumn.column_name, true)
            .min(`${lmtColumn.column_name} as oldest`)
            .first(),
          null,
          { raw: true, first: true },
        );

        if (remainingTrash?.oldest) {
          // Schedule next check for when the oldest remaining record expires
          const oldestDate = new Date(remainingTrash.oldest);
          const nextDueAt = new Date(
            oldestDate.getTime() + retentionDays * 24 * 60 * 60 * 1000,
          );
          await Model.updateTrashCleanupDueAt(
            context,
            model.id,
            nextDueAt.toISOString(),
          );
        } else {
          // No trash remaining — clear the schedule
          await Model.updateTrashCleanupDueAt(context, model.id, null);
        }

        if (deletedInModel > 0) {
          this.logger.log(
            `Permanently deleted ${deletedInModel} records from ${model.table_name} (retention: ${retentionDays}d)`,
          );
        }

        tablesProcessed++;
      } catch (e) {
        this.logger.error(
          `Error cleaning trash for model ${modelRow.id}: ${e.message}`,
          e.stack,
        );
      }
    }

    if (totalDeleted > 0 || tablesProcessed > 0) {
      this.logger.log(
        `Record trash cleanup complete. Tables processed: ${tablesProcessed}/${MAX_TABLES_PER_RUN}. Total permanently deleted: ${totalDeleted}`,
      );
    }

    return { totalDeleted, tablesProcessed };
  }
}
