import { randomUUID } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { NcApiVersion, NOCO_SERVICE_USERS, ServiceUserType } from 'nocodb-sdk';
import type { Job } from 'bull';
import type { NcContext } from '~/interface/config';
import type { ColumnBackupRef } from '~/services/column-data-backup-handler';
import { MetaTable } from '~/utils/globals';
import Noco from '~/Noco';
import { ColumnDataBackupHandler } from '~/services/column-data-backup-handler.service';
import { acquireLock, releaseLock } from '~/helpers/lockHelpers';
import { OperationLog } from '~/models';

const BATCH_SIZE = 100;
const MAX_PER_RUN = 2000;
const LOCK_KEY = 'lock:operation-cleanup';
const LOCK_TTL_SECONDS = 9 * 60;
// Pushes the row past the current tick so a crashed cleanup retries in ~1h
// and a concurrent undo/redo bump (which moves cleanup_due_at days into the
// future) wins the race cleanly.
const CLAIM_HORIZON_MS = 60 * 60 * 1000;

interface OpLogRow {
  id: string;
  fk_workspace_id?: string | null;
  base_id?: string | null;
  meta?: string | Record<string, unknown> | null;
}

interface MacroTranscriptEntryShape {
  extra?: { backup?: ColumnBackupRef } & Record<string, unknown>;
}

interface OpLogMeta {
  /** Top-level capture from a non-macro op (e.g. `columnUpdate`). */
  backup?: ColumnBackupRef;
  /** Macro ops persist children in this transcript; each entry's
   *  `extra` is a `Partial<CaptureBag>` and may carry its own backup
   *  ref. Macro children don't write their own log row, so their
   *  backups are only reachable here — without this, they'd leak. */
  macroTranscript?: ReadonlyArray<MacroTranscriptEntryShape>;
}

/** Collect every `ColumnBackupRef` reachable from this row's meta —
 *  top-level + every macro-transcript child. */
function collectBackupRefs(meta: OpLogMeta): ColumnBackupRef[] {
  const refs: ColumnBackupRef[] = [];
  if (meta.backup) refs.push(meta.backup);
  if (Array.isArray(meta.macroTranscript)) {
    for (const entry of meta.macroTranscript) {
      if (entry?.extra?.backup) refs.push(entry.extra.backup);
    }
  }
  return refs;
}

/**
 * Sweeps `nc_operation_logs` rows past their `cleanup_due_at`. For rows
 * whose `meta` references a `ColumnBackupRef`, drops the backup column via
 * `ColumnDataBackupHandler.drop` first, then deletes the log row.
 *
 * Mirrors the `base-trash-clean-up` processor: lock-guarded, batched, with
 * `cleanup_due_at` bumped forward on per-row failures so a poisoned row
 * doesn't burn the per-tick budget every sweep.
 */
@Injectable()
export class OperationCleanupProcessor {
  private readonly logger = new Logger(OperationCleanupProcessor.name);

  constructor(
    private readonly columnDataBackupHandler: ColumnDataBackupHandler,
  ) {}

  async job(job: Job) {
    this.logger.debug(`Job started for ${job.id}`);

    const lockId = randomUUID();
    const gotLock = await acquireLock(LOCK_KEY, lockId, 0, LOCK_TTL_SECONDS);
    if (!gotLock) {
      this.logger.log(
        `Skipping ${job.id} — another operation-cleanup run is active`,
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
      const batch: OpLogRow[] = await Noco.ncOperationLogs
        .knex(MetaTable.OPERATION_LOGS)
        .where('cleanup_due_at', '<=', now)
        .orderBy('cleanup_due_at', 'asc')
        .select('id', 'fk_workspace_id', 'base_id', 'meta')
        .limit(BATCH_SIZE);

      if (!batch.length) break;

      for (const row of batch) {
        const cleaned = await this.cleanupRow(row, now);
        if (cleaned) totalCleaned++;
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

  private parseMeta(raw: unknown): OpLogMeta {
    if (!raw) return {};
    if (typeof raw === 'string') {
      try {
        return JSON.parse(raw);
      } catch {
        return {};
      }
    }
    if (typeof raw === 'object') return raw as OpLogMeta;
    return {};
  }

  /**
   * Cleanup a single row:
   *   1. Atomically claim the row by conditionally pushing
   *      `cleanup_due_at` forward — if an in-flight undo/redo bumped it
   *      between batch SELECT and now, the claim fails and we skip.
   *   2. If `meta.backup` references a ColumnBackupRef, drop the backup
   *      column via the handler.
   *   3. Delete the log row.
   * Failures bump `cleanup_due_at` forward by ~1h.
   *
   * @returns true if the row was deleted (counted toward per-run budget)
   */
  private async cleanupRow(row: OpLogRow, tickNow: string): Promise<boolean> {
    const meta = this.parseMeta(row.meta);

    const systemUser = NOCO_SERVICE_USERS[ServiceUserType.TRASH_CLEANUP_USER];
    const context: NcContext = {
      workspace_id: row.fk_workspace_id ?? '',
      base_id: row.base_id ?? '',
      user: systemUser as NcContext['user'],
      api_version: NcApiVersion.V2,
      socket_id: null,
    };

    const claimDeadline = new Date(Date.now() + CLAIM_HORIZON_MS).toISOString();
    const claimed = await Noco.ncOperationLogs
      .knex(MetaTable.OPERATION_LOGS)
      .where('id', row.id)
      .where('cleanup_due_at', '<=', tickNow)
      .update({ cleanup_due_at: claimDeadline });
    if (!claimed) return false;

    try {
      const backupRefs = collectBackupRefs(meta);
      for (const backupRef of backupRefs) {
        await this.columnDataBackupHandler.drop(context, { backupRef });
      }

      await Noco.ncOperationLogs
        .knex(MetaTable.OPERATION_LOGS)
        .where('id', row.id)
        .delete();

      return true;
    } catch (err: any) {
      this.logger.error(
        `Operation cleanup failed on ${row.id}: ${err.message}`,
        err.stack,
      );

      try {
        await OperationLog.bumpCleanupDueAt(context, row.id);
      } catch (bumpErr: any) {
        this.logger.error(
          `Failed to bump cleanup_due_at for op log ${row.id}: ${bumpErr.message}`,
          bumpErr.stack,
        );
      }

      return false;
    }
  }
}
