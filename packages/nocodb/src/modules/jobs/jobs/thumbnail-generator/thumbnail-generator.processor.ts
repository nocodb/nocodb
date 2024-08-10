import path from 'path';
import { Readable } from 'stream';
import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { Logger } from '@nestjs/common';
import type { IStorageAdapterV2 } from 'nc-plugin';
import type { AttachmentResType } from 'nocodb-sdk';
import type { ThumbnailGeneratorJobData } from '~/interface/Jobs';
import type Sharp from 'sharp';
import { JOBS_QUEUE, JobTypes } from '~/interface/Jobs';
import NcPluginMgrv2 from '~/helpers/NcPluginMgrv2';
import { getPathFromUrl } from '~/helpers/attachmentHelpers';

@Processor(JOBS_QUEUE)
export class ThumbnailGeneratorProcessor {
  constructor() {}

  private logger = new Logger(ThumbnailGeneratorProcessor.name);

  @Process(JobTypes.ThumbnailGenerator)
  async job(job: Job<ThumbnailGeneratorJobData>) {
    const { attachments } = job.data;

    const thumbnailPromises = attachments.map(async (attachment) => {
      const thumbnail = await this.generateThumbnail(attachment);
      return {
        path: attachment.path ?? attachment.url,
        card_cover: thumbnail?.card_cover,
        small: thumbnail?.small,
        tiny: thumbnail?.tiny,
      };
    });

    return await Promise.all(thumbnailPromises);
  }

  private async generateThumbnail(
    attachment: AttachmentResType,
  ): Promise<{ [key: string]: string }> {
    let sharp: typeof Sharp;

    try {
      sharp = (await import('sharp')).default;
    } catch {
      // ignore
    }

    if (!sharp) {
      this.logger.warn(
        `Thumbnail generation is not supported in this platform at the moment.`,
      );
      return;
    }

    try {
      const storageAdapter = await NcPluginMgrv2.storageAdapter();

      const { file, relativePath } = await this.getFileData(
        attachment,
        storageAdapter,
      );

      const thumbnailPaths = {
        card_cover: path.join(
          'nc',
          'thumbnails',
          relativePath,
          'card_cover.jpg',
        ),
        small: path.join('nc', 'thumbnails', relativePath, 'small.jpg'),
        tiny: path.join('nc', 'thumbnails', relativePath, 'tiny.jpg'),
      };

      await Promise.all(
        Object.entries(thumbnailPaths).map(async ([size, thumbnailPath]) => {
          let height;
          switch (size) {
            case 'card_cover':
              height = 512;
              break;
            case 'small':
              height = 128;
              break;
            case 'tiny':
              height = 64;
              break;
            default:
              height = 32;
              break;
          }

          const resizedImage = await sharp(file, {
            limitInputPixels: false,
          })
            .resize(undefined, height, {
              fit: sharp.fit.cover,
              kernel: 'lanczos3',
            })
            .toBuffer();

          await (storageAdapter as any).fileCreateByStream(
            thumbnailPath,
            Readable.from(resizedImage),
            {
              mimetype: 'image/jpeg',
            },
          );
        }),
      );

      return thumbnailPaths;
    } catch (error) {
      this.logger.error(
        `Failed to generate thumbnails for ${
          attachment.path ?? attachment.url
        }`,
        error.stack as string,
      );
    }
  }

  private async getFileData(
    attachment: AttachmentResType,
    storageAdapter: IStorageAdapterV2,
  ): Promise<{ file: Buffer; relativePath: string }> {
    let relativePath;

    if (attachment.path) {
      relativePath = path.join(
        'nc',
        'uploads',
        attachment.path.replace(/^download\//, ''),
      );
    } else if (attachment.url) {
      relativePath = getPathFromUrl(attachment.url).replace(/^\/+/, '');
    }

    const file = await storageAdapter.fileRead(relativePath);

    // remove everything before 'nc/uploads/' (including nc/uploads/) in relativePath
    relativePath = relativePath.replace(/.*?nc\/uploads\//, '');

    return { file, relativePath };
  }
}
