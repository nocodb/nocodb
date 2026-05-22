import { randomUUID } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import {
  NcApiVersion,
  NcErrorType,
  NOCO_SERVICE_USERS,
  ServiceUserType,
} from 'nocodb-sdk';
import type { Job } from 'bull';
import type { NcContext, NcRequest } from '~/interface/config';
import { MetaTable } from '~/utils/globals';
import Noco from '~/Noco';
import { Base, BaseTrash, Workspace } from '~/models';
import { BaseTrashService } from '~/services/base-trash/base-trash.service';
import { TelemetryHandlerService } from '~/services/telemetry-handler.service';
import { acquireLock, releaseLock } from '~/helpers/lockHelpers';

const BATCH_SIZE = 50;
const MAX_PER_RUN = 1000;
// Linear backoff: each failed attempt defers the entry by this duration.
// Row 1 failure → +1h, 2 failures → +2h, etc. Prevents a poisoned row from
// consuming the MAX_PER_RUN budget on every tick.
const RETRY_BACKOFF_MS = 60 * 60 * 1000; // 1h
// Emit a priority_error telemetry every Nth consecutive failure (5, 10, 15…)
// so a single missed alert doesn't park the row silently forever. Backoff
// keeps growing between alerts, so cadence is naturally exponential — fires
// after ~5h cumulative, then ~2d, then ~5d, then ~9d, etc.
const MAX_RETRIES_BEFORE_ALERT = 5;
const LOCK_KEY = 'lock:base-trash-cleanup';
const LOCK_TTL_SECONDS = 9 * 60;

@Injectable()
export class BaseTrashCleanUpProcessor {
  private readonly logger = new Logger(BaseTrashCleanUpProcessor.name);

  constructor(private readonly baseTrashService: BaseTrashService) {}

  async job(job: Job) {
    this.logger.debug(`Job started for ${job.id}`);

    // Skip this tick if another worker is already running. Bull's jobId
    // dedups within a single queue, but on multi-instance EE worker pools
    // a long cleanup could overlap with the next cron fire and reprocess
    // the same batch.
    const lockId = randomUUID();
    const gotLock = await acquireLock(LOCK_KEY, lockId, 0, LOCK_TTL_SECONDS);
    if (!gotLock) {
      this.logger.log(
        `Skipping ${job.id} — another base-trash cleanup run is active`,
      );
      return;
    }

    try {
      return await this.runCleanup(job);
    } finally {
      await releaseLock(LOCK_KEY, lockId);
    }
  }

  private async runCleanup(job: Job) {
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
          'parent_type',
          'parent_id',
          'meta',
        )
        .limit(BATCH_SIZE);

      if (!batch.length) break;

      const systemUser = NOCO_SERVICE_USERS[ServiceUserType.TRASH_CLEANUP_USER];

      for (const entry of batch) {
        const context: NcContext = {
          workspace_id: entry.fk_workspace_id,
          base_id: entry.base_id,
          user: systemUser as NcContext['user'],
          api_version: NcApiVersion.V2,
          socket_id: null,
        };

        const workspace =
          entry.fk_workspace_id && (await Workspace.get(entry.fk_workspace_id));
        const base =
          workspace && entry.base_id && (await Base.get(context, entry.base_id));
        if (!workspace || !base) {
          const reason = !workspace
            ? `parent workspace ${entry.fk_workspace_id} deleted`
            : `parent base ${entry.base_id} deleted`;
          try {
            await BaseTrash.delete(context, entry.id);
            this.logger.log(
              `Trash entry ${entry.id} orphaned (${reason}); removed.`,
            );
          } catch (delErr) {
            this.logger.error(
              `Failed to drop orphaned trash entry ${entry.id}: ${delErr.message}`,
              delErr.stack,
            );
          }
          continue;
        }

        try {
          await this.baseTrashService.permanentDelete(context, {
            trashId: entry.id,
            user: systemUser,
            req: {
              user: systemUser,
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
          // Handler signaled the parent is still in trash. Defer this child
          // until after the parent's cleanup runs — that pass cascades through
          // children via BaseTrashService childTypes (with the parent temp-
          // restored), which is the safe path for these handlers.
          if (e?.error === NcErrorType.ERR_PARENT_IN_TRASH) {
            try {
              const parentTrash =
                entry.parent_id && entry.parent_type
                  ? await Noco.ncMeta
                      .knex(MetaTable.TRASH)
                      .where({
                        fk_workspace_id: entry.fk_workspace_id,
                        base_id: entry.base_id,
                        resource_type: entry.parent_type,
                        resource_id: entry.parent_id,
                      })
                      .first('cleanup_due_at')
                  : null;
              const parentDueAt = parentTrash?.cleanup_due_at
                ? new Date(parentTrash.cleanup_due_at).getTime()
                : Date.now() + RETRY_BACKOFF_MS;
              const deferredDueAt = new Date(parentDueAt + 1000).toISOString();
              await BaseTrash.update(context, entry.id, {
                cleanup_due_at: deferredDueAt,
              });
              this.logger.debug(
                `Trash entry ${entry.id} deferred — parent ${entry.parent_type}:${entry.parent_id} not yet cleaned.`,
              );
            } catch (deferErr) {
              this.logger.error(
                `Failed to defer trash entry ${entry.id}: ${deferErr.message}`,
                deferErr.stack,
              );
            }
            continue;
          }
          // `recordNotTrashed` means the underlying soft-deleted rows are gone
          // — restored by the user, or already hard-deleted by another path
          // (manual trash UI action, base/table delete cascade). The trash
          // entry itself is stale and will never be re-cleanable; drop it so
          // we don't burn cleanup_due_at backoff and priority_error telemetry
          // on it forever. The same prod entries (e.g. trk5t7x75iurtuy5) hit
          // 15 retries on identical errors before this guard existed.
          if (e?.error === NcErrorType.ERR_RECORD_NOT_TRASHED) {
            try {
              await BaseTrash.delete(context, entry.id);
              this.logger.log(
                `Trash entry ${entry.id} resolved as stale (records no longer trashed); removed.`,
              );
            } catch (delErr) {
              this.logger.error(
                `Failed to drop stale trash entry ${entry.id}: ${delErr.message}`,
                delErr.stack,
              );
            }
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

            if (
              retryCount >= MAX_RETRIES_BEFORE_ALERT &&
              retryCount % MAX_RETRIES_BEFORE_ALERT === 0
            ) {
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
    } else {
      this.logger.debug(`Job completed for ${job.id} — no entries ready`);
    }
  }
}
