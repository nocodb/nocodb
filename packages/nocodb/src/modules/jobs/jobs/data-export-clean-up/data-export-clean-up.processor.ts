import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import debug from 'debug';
import { Injectable } from '@nestjs/common';
import moment from 'moment';
import type { Job } from 'bull';
import type { IStorageAdapterV2 } from '~/types/nc-plugin';
import NcPluginMgrv2 from '~/helpers/NcPluginMgrv2';
import NocoCache from '~/cache/NocoCache';
import Local from '~/plugins/storage/Local';
import { validateAndNormaliseLocalPath } from '~/helpers/attachmentHelpers';
import { CacheGetType } from '~/utils/globals';

const DATA_EXPORT_PREFIX = 'nc/uploads/data-export';
const DELETE_BATCH_SIZE = 500;
const LOCK_KEY = 'data-export-clean-up:lock';
const LOCK_TTL_SECONDS = 2 * 60 * 60;
// stays well under the lock TTL; a large backlog drains over several runs
const RUN_BUDGET_MS = 45 * 60 * 1000;

@Injectable()
export class DataExportCleanUpProcessor {
  private readonly debugLog = debug('nc:jobs:data-export-clean-up');

  async job(job: Job) {
    this.debugLog(`Job started for ${job.id}`);

    const lockId = randomUUID();
    const gotLock = await NocoCache.setIfNotExist(
      'root',
      LOCK_KEY,
      JSON.stringify({ lockId }),
      LOCK_TTL_SECONDS,
    );
    if (!gotLock) {
      this.debugLog(`Skipping ${job.id}: another clean-up run is active`);
      return;
    }

    try {
      return await this.cleanUp(job);
    } catch (e) {
      this.debugLog(`Job failed: ${e.message}`);
      throw e;
    } finally {
      const lock = await NocoCache.get(
        'root',
        LOCK_KEY,
        CacheGetType.TYPE_OBJECT,
      ).catch(() => null);
      if (lock?.lockId === lockId) {
        await NocoCache.del('root', LOCK_KEY).catch(() => undefined);
      }
    }
  }

  private async cleanUp(job: Job) {
    const storageAdapter = await NcPluginMgrv2.storageAdapter();
    const startedAt = Date.now();

    // folders are named YYYY-MM-DD; anything before the cutoff day is past its 3h link
    const cutoffDateFormatted = moment()
      .subtract(4, 'hours')
      .format('YYYY-MM-DD');

    const fileStream = await storageAdapter.scanFiles(
      `${DATA_EXPORT_PREFIX}/**`,
    );

    let scannedCount = 0;
    let deletedCount = 0;
    let batch: string[] = [];

    for await (const filePath of fileStream) {
      scannedCount++;

      if (
        typeof filePath === 'string' &&
        filePath.startsWith(`${DATA_EXPORT_PREFIX}/`)
      ) {
        // nc/uploads/data-export/YYYY-MM-DD/HH/...
        const folderDate = filePath.split('/')[3];
        if (folderDate && folderDate < cutoffDateFormatted) {
          batch.push(filePath);
        }
      }

      if (batch.length >= DELETE_BATCH_SIZE) {
        deletedCount += await this.deleteFiles(storageAdapter, batch);
        batch = [];
      }

      if (Date.now() - startedAt > RUN_BUDGET_MS) {
        this.debugLog('Run budget reached, continuing on the next run');
        break;
      }
    }

    if (batch.length) {
      deletedCount += await this.deleteFiles(storageAdapter, batch);
    }

    this.debugLog(
      `Data export cleanup completed: Scanned ${scannedCount} files, deleted ${deletedCount} files`,
    );
    this.debugLog(`Job completed for ${job.id}`);
    return true;
  }

  private async deleteFiles(
    storageAdapter: IStorageAdapterV2,
    keys: string[],
  ): Promise<number> {
    let deleted: number | null = null;

    if (storageAdapter.fileDeleteBatch) {
      deleted = await storageAdapter.fileDeleteBatch(keys).catch((e) => {
        this.debugLog(`Batch delete failed, deleting one by one: ${e.message}`);
        return null;
      });
    }

    if (deleted === null) {
      deleted = 0;
      for (const key of keys) {
        try {
          await storageAdapter.fileDelete(key);
          deleted++;
        } catch (e) {
          this.debugLog(`Error deleting file ${key}: ${e.message}`);
        }
      }
    }

    if (storageAdapter instanceof Local) {
      await this.removeEmptyLocalFolders(keys);
    }

    return deleted;
  }

  // drop the per-export folder and any parent left empty, up to data-export/
  private async removeEmptyLocalFolders(keys: string[]) {
    const folders = new Set(keys.map((key) => path.posix.dirname(key)));
    for (const folder of folders) {
      let dir = folder;
      while (dir.startsWith(`${DATA_EXPORT_PREFIX}/`)) {
        try {
          await fs.promises.rmdir(validateAndNormaliseLocalPath(dir));
        } catch {
          // not empty (or already gone)
          break;
        }
        dir = path.posix.dirname(dir);
      }
    }
  }
}
