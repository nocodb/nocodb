import path from 'path';
import debug from 'debug';
import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { JOBS_QUEUE, JobTypes } from '~/interface/Jobs';
import Noco from '~/Noco';
import { MetaTable } from '~/utils/globals';
import NcPluginMgrv2 from '~/helpers/NcPluginMgrv2';
import { getPathFromUrl } from '~/helpers/attachmentHelpers';

@Processor(JOBS_QUEUE)
export class AttachmentCleanUpProcessor {
  private readonly debugLog = debug('nc:jobs:attachment-clean-up');

  constructor() {}

  @Process(JobTypes.AttachmentCleanUp)
  async job(job: Job) {
    this.debugLog(`job started for ${job.id}`);

    const ncMeta = Noco.ncMeta;

    const storageAdapter = await NcPluginMgrv2.storageAdapter();

    const storageAdapterName = storageAdapter.name;

    const orphanedFilesQueryBuilder = ncMeta
      .knexConnection(MetaTable.FILE_REFERENCES)
      .whereIn(
        'file_url',
        ncMeta
          .knexConnection(MetaTable.FILE_REFERENCES)
          .select('file_url')
          .groupBy('file_url')
          .havingRaw('COUNT(*) = COUNT(CASE WHEN deleted THEN 1 END)'),
      );

    const orphanedFiles = await orphanedFilesQueryBuilder.select('file_url');

    for (const file of orphanedFiles) {
      let relativePath;

      if (storageAdapterName === 'Local') {
        relativePath = file.file_url.replace(/^\/?nc\/uploads\//, '');
      } else {
        relativePath = getPathFromUrl(file.file_url, true);
      }

      await storageAdapter.fileDelete(path.join('nc', 'uploads', relativePath));

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
    }

    this.debugLog(`job completed for ${job.id}`);
  }
}
