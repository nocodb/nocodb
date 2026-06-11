import path from 'path';
import debug from 'debug';
import type { Job } from 'bull';
import Noco from '~/Noco';
import { MetaTable } from '~/utils/globals';
import NcPluginMgrv2 from '~/helpers/NcPluginMgrv2';
import { getPathFromUrl } from '~/helpers/attachmentHelpers';

const retentionDays = process.env.NC_ATTACHMENT_RETENTION_DAYS || 10;

export class AttachmentCleanUpProcessor {
  private readonly debugLog = debug('nc:jobs:attachment-clean-up');

  async job(job: Job) {
    // if retentionDays is set to 0, clean up is disabled
    if (+retentionDays === 0) {
      return;
    }

    this.debugLog(`job started for ${job.id}`);

    const ncMeta = Noco.ncMeta;

    const storageAdapter = await NcPluginMgrv2.storageAdapter();

    const storageAdapterName = storageAdapter.name;

    const orphanedFilesQueryBuilder = ncMeta
      .knexConnection(MetaTable.FILE_REFERENCES)
      .select('file_url')
      .max('updated_at', { as: 'last_updated_at' })
      .groupBy('file_url')
      .havingRaw('COUNT(*) = COUNT(CASE WHEN deleted THEN 1 END)');

    const orphanedFiles = await orphanedFilesQueryBuilder.select('file_url');

    for (const file of orphanedFiles) {
      if (
        new Date(file.last_updated_at).getTime() >
        new Date().getTime() - +retentionDays * 24 * 60 * 60 * 1000
      ) {
        // skip if marked as deleted within the retention period
        continue;
      }

      let relativePath;

      const rootKey = await ncMeta
        .knexConnection(MetaTable.FILE_REFERENCES)
        .where('file_url', file.file_url)
        .select('storage', 'file_url')
        .whereNotNull('storage')
        .first();

      if (rootKey) {
        file.storage = rootKey.storage;

        // skip if file is not stored in the current storage adapter
        if (file.storage !== storageAdapterName) {
          continue;
        }
      }

      if (storageAdapterName === 'Local') {
        relativePath = file.file_url.replace(/^download\//, '');
      } else {
        relativePath = getPathFromUrl(file.file_url, true);
      }

      try {
        await storageAdapter.fileDelete(
          path.join('nc', 'uploads', relativePath),
        );

        const thumbnails = ['tiny.jpg', 'small.jpg', 'card_cover.jpg'];

        for (const thumb of thumbnails) {
          await storageAdapter.fileDelete(
            path.join('nc', 'thumbnails', relativePath, thumb),
          );
        }

        await ncMeta
          .knexConnection(MetaTable.FILE_REFERENCES)
          .where('file_url', file.file_url)
          .del();
      } catch (e) {
        this.debugLog(`error deleting file ${file.file_url}: ${e.message}`);
      }
    }

    this.debugLog(`job completed for ${job.id}`);
  }
}
