import path from 'path';
import { Readable } from 'stream';
import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { Logger } from '@nestjs/common';
import sharp from 'sharp';
import axios from 'axios';
import type { AttachmentResType } from 'nocodb-sdk';
import type { ThumbnailGeneratorJobData } from '~/interface/Jobs';
import { JOBS_QUEUE, JobTypes } from '~/interface/Jobs';
import NcPluginMgrv2 from '~/helpers/NcPluginMgrv2';
import { PresignedUrl } from '~/models';
import { AttachmentsService } from '~/services/attachments.service';

const attachmentPreviews = ['image/'];

@Processor(JOBS_QUEUE)
export class ThumbnailGeneratorProcessor {
  constructor(private readonly attachmentsService: AttachmentsService) {}

  private logger = new Logger(ThumbnailGeneratorProcessor.name);

  @Process(JobTypes.ThumbnailGenerator)
  async job(job: Job<ThumbnailGeneratorJobData>) {
    try {
      const { attachments } = job.data;

      const thumbnailPromises = attachments
        .filter((attachment) =>
          attachmentPreviews.some((type) =>
            attachment.mimetype.startsWith(type),
          ),
        )
        .map(async (attachment) => {
          const thumbnail = await this.generateThumbnail(attachment);
          return {
            path: attachment.path ?? attachment.url,
            card_cover: thumbnail?.card_cover,
            small: thumbnail?.small,
            tiny: thumbnail?.tiny,
          };
        });

      return await Promise.all(thumbnailPromises);
    } catch (error) {
      this.logger.error('Failed to generate thumbnails', error);
    }
  }

  private async generateThumbnail(
    attachment: AttachmentResType,
  ): Promise<{ [key: string]: string }> {
    const { file, relativePath } = await this.getFileData(attachment);

    const thumbnailPaths = {
      card_cover: path.join('nc', 'thumbnails', relativePath, 'card_cover.jpg'),
      small: path.join('nc', 'thumbnails', relativePath, 'small.jpg'),
      tiny: path.join('nc', 'thumbnails', relativePath, 'tiny.jpg'),
    };

    try {
      const storageAdapter = await NcPluginMgrv2.storageAdapter();

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
        `Failed to generate thumbnails for ${attachment.path}`,
        error,
      );
    }
  }

  private async getFileData(
    attachment: AttachmentResType,
  ): Promise<{ file: Buffer; relativePath: string }> {
    let url, signedUrl, file;
    let relativePath;

    if (attachment.path) {
      relativePath = attachment.path.replace(/^download\//, '');
      url = await PresignedUrl.getSignedUrl({
        pathOrUrl: relativePath,
        preview: false,
        filename: attachment.title,
        mimetype: attachment.mimetype,
      });

      const fullPath = await PresignedUrl.getPath(`${url}`);
      const [fpath] = fullPath.split('?');
      const tempPath = await this.attachmentsService.getFile({
        path: path.join('nc', 'uploads', fpath),
      });
      relativePath = fpath;
      file = tempPath.path;
    } else if (attachment.url) {
      relativePath = decodeURI(new URL(attachment.url).pathname);

      signedUrl = await PresignedUrl.getSignedUrl({
        pathOrUrl: relativePath,
        preview: false,
        filename: attachment.title,
        mimetype: attachment.mimetype,
      });

      file = (await axios({ url: signedUrl, responseType: 'arraybuffer' }))
        .data as Buffer;
    }

    if (relativePath.startsWith('/nc/uploads/')) {
      relativePath = relativePath.replace('/nc/uploads/', '');
    }

    return { file, relativePath };
  }
}
