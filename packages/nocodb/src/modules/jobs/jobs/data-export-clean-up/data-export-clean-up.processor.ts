import debug from 'debug';
import PQueue from 'p-queue';
import { Injectable } from '@nestjs/common';
import moment from 'moment';
import type { Job } from 'bull';
import NcPluginMgrv2 from '~/helpers/NcPluginMgrv2';

@Injectable()
export class DataExportCleanUpProcessor {
  private readonly debugLog = debug('nc:jobs:data-export-clean-up');

  async job(job: Job) {
    this.debugLog(`Job started for ${job.id}`);

    const queue = new PQueue({ concurrency: 1 });

    try {
      const storageAdapter = await NcPluginMgrv2.storageAdapter();
      const cutoffDate = moment().subtract(4, 'hours');

      // Convert cutoff date to YYYY-MM-DD format to match folder structure
      const cutoffDateFormatted = cutoffDate.format('YYYY-MM-DD');

      // The pattern will match all files in data-export folders that are older than the cutoff date
      const globPattern = `nc/uploads/data-export/**`;

      const fileStream = await storageAdapter.scanFiles(globPattern);

      // Track statistics for logging
      let scannedCount = 0;
      let deletedCount = 0;
      let errorCount = 0;

      return new Promise((resolve, reject) => {
        fileStream.on('error', (error) => {
          this.debugLog(`Error scanning files: ${error.message}`);
          reject(error);
        });

        fileStream.on('data', (filePath) => {
          scannedCount++;

          // Add file processing task to the queue
          queue
            .add(async () => {
              try {
                // Skip if not a data export file
                if (
                  !filePath ||
                  typeof filePath !== 'string' ||
                  !filePath.startsWith('nc/uploads/data-export')
                ) {
                  return;
                }

                // Extract date from file path (format: nc/uploads/data-export/YYYY-MM-DD/HH/...)
                const pathParts = filePath.split('/');
                const dateIndex = pathParts.indexOf('data-export') + 1;

                if (dateIndex >= pathParts.length || !pathParts[dateIndex]) {
                  return;
                }

                const folderDate = pathParts[dateIndex];

                // Check if folder date is before cutoff date
                if (folderDate && folderDate < cutoffDateFormatted) {
                  await storageAdapter.fileDelete(filePath);
                  deletedCount++;
                  this.debugLog(`Deleted old export file: ${filePath}`);
                }
              } catch (e) {
                errorCount++;
                this.debugLog(
                  `Error processing file ${filePath}: ${e.message}`,
                );
                // Don't rethrow to prevent queue from stopping
              }
            })
            .catch((err) => {
              errorCount++;
              this.debugLog(
                `Queue error processing file ${filePath}: ${err.message}`,
              );
            });
        });

        fileStream.on('end', async () => {
          try {
            // Wait for all queued tasks to complete
            await queue.onIdle();
            this.debugLog(
              `Data export cleanup completed: Scanned ${scannedCount} files, deleted ${deletedCount} files, encountered ${errorCount} errors`,
            );
            this.debugLog(`Job completed for ${job.id}`);
            resolve(true);
          } catch (err) {
            this.debugLog(
              `Error waiting for queue to complete: ${err.message}`,
            );
            reject(err);
          }
        });
      });
    } catch (e) {
      this.debugLog(`Job failed: ${e.message}`);
      throw e;
    }
  }
}
