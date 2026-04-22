import { Injectable, Logger } from '@nestjs/common';
import { NcErrorType, NOCO_SERVICE_USERS, ServiceUserType } from 'nocodb-sdk';
import type { Job } from 'bull';
import type { NcContext, NcRequest } from '~/interface/config';
import { MetaTable } from '~/utils/globals';
import Noco from '~/Noco';
import BaseTrash from '~/models/BaseTrash';
import { BaseTrashService } from '~/services/base-trash/base-trash.service';
import { TelemetryHandlerService } from '~/services/telemetry-handler.service';

const BATCH_SIZE = 50;
const MAX_PER_RUN = 1000;
// Linear backoff: each failed attempt defers the entry by this duration.
// Row 1 failure → +1h, 2 failures → +2h, etc. Prevents a poisoned row from
// consuming the MAX_PER_RUN budget on every tick.
const RETRY_BACKOFF_MS = 60 * 60 * 1000; // 1h
// After this many consecutive failures, emit a priority_error telemetry so ops
// can intervene. Backoff still continues so we don't flood the firehose.
const MAX_RETRIES_BEFORE_ALERT = 5;

@Injectable()
export class BaseTrashCleanUpProcessor {
  private readonly logger = new Logger(BaseTrashCleanUpProcessor.name);

  constructor(private readonly baseTrashService: BaseTrashService) {}

  async job(job: Job) {
    this.logger.debug(`Job started for ${job.id}`);

    const now = new Date().toISOString();
    let totalCleaned = 0;

    while (totalCleaned < MAX_PER_RUN) {
      const batch = await Noco.ncMeta
        .knex(MetaTable.TRASH)
        .whereNotNull('cleanup_due_at')
        .where('cleanup_due_at', '<=', now)
        .orderBy('cleanup_due_at', 'asc')
        .select(
          'id',
          'fk_workspace_id',
          'base_id',
          'deleted_by',
          'resource_type',
          'resource_id',
          'meta',
        )
        .limit(BATCH_SIZE);

      if (!batch.length) break;

      for (const entry of batch) {
        const context: NcContext = {
          workspace_id: entry.fk_workspace_id,
          base_id: entry.base_id,
        };

        try {
          await this.baseTrashService.permanentDelete(context, {
            trashId: entry.id,
            user: NOCO_SERVICE_USERS[ServiceUserType.TRASH_CLEANUP_USER],
            req: {
              user: NOCO_SERVICE_USERS[ServiceUserType.TRASH_CLEANUP_USER],
            } as NcRequest,
          });

          totalCleaned++;
        } catch (e) {
          // Row was restored / permanently deleted by a concurrent user action
          // between our batch read and permanentDelete. Not a failure — just
          // move on silently
          if (e?.error === NcErrorType.ERR_TRASH_NOT_FOUND) {
            continue;
          }

          this.logger.error(
            `Failed to clean trash entry ${entry.id}: ${e.message}`,
            e.stack,
          );

          // Bump cleanup_due_at forward proportional to retry count so a
          // poisoned row doesn't hog MAX_PER_RUN every tick. Track retry
          // count in meta (existing JSON column — no schema change needed).
          try {
            // meta may arrive as a JSON string (raw knex select) or already parsed
            let meta: Record<string, any> = {};
            if (entry.meta) {
              try {
                meta =
                  typeof entry.meta === 'string'
                    ? JSON.parse(entry.meta)
                    : entry.meta;
              } catch {
                meta = {};
              }
            }

            const retryCount = ((meta.cleanup_retry_count as number) ?? 0) + 1;
            meta.cleanup_retry_count = retryCount;
            meta.last_cleanup_error = e?.message ?? 'unknown';

            const nextDueAt = new Date(
              Date.now() + RETRY_BACKOFF_MS * retryCount,
            ).toISOString();

            await BaseTrash.update(context, entry.id, {
              cleanup_due_at: nextDueAt,
              meta,
            });

            if (retryCount === MAX_RETRIES_BEFORE_ALERT) {
              TelemetryHandlerService.sendPriorityError(context, {
                trigger: 'base_trash_cleanup',
                error_type: e?.name ?? 'Error',
                message: `Trash entry ${entry.id} failed ${retryCount} cleanup attempts: ${e?.message}`,
                error_details: e?.stack,
                affected_resources: [
                  entry.id,
                  entry.resource_type,
                  entry.resource_id,
                ],
              });
            }
          } catch (bumpErr) {
            this.logger.error(
              `Failed to record retry for ${entry.id}: ${bumpErr.message}`,
              bumpErr.stack,
            );
          }
        }
      }

      if (batch.length < BATCH_SIZE) break;
    }

    if (totalCleaned > 0) {
      this.logger.log(
        `Job completed for ${job.id} — cleaned ${totalCleaned} entries`,
      );
    }
  }
}
