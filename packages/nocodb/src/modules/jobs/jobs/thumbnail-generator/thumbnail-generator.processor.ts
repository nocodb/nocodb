import path from 'path';
import { Readable } from 'stream';
import { Logger } from '@nestjs/common';
import slash from 'slash';
import type { IStorageAdapterV2 } from '~/types/nc-plugin';
import type { Job } from 'bull';
import type { AttachmentResType, PublicAttachmentScope } from 'nocodb-sdk';
import type { ThumbnailGeneratorJobData } from '~/interface/Jobs';
import NcPluginMgrv2 from '~/helpers/NcPluginMgrv2';
import { getPathFromUrl } from '~/helpers/attachmentHelpers';
import Noco from '~/Noco';

export class ThumbnailGeneratorProcessor {
  private logger = new Logger(ThumbnailGeneratorProcessor.name);

  async job(job: Job<ThumbnailGeneratorJobData>) {
    const { attachments, scope } = job.data;

    const results = [];

    for (const attachment of attachments) {
      const thumbnail = await this.generateThumbnail(attachment, scope);

      if (!thumbnail) {
        continue;
      }

      results.push({
        path: attachment.path ?? attachment.url,
        card_cover: thumbnail?.card_cover,
        small: thumbnail?.small,
        tiny: thumbnail?.tiny,
      });
    }

    return results;
  }

  private async generateThumbnail(
    attachment: AttachmentResType,
    scope?: PublicAttachmentScope,
  ): Promise<{ [key: string]: string }> {
    const sharp = Noco.sharp;

    if (!sharp) {
      return null;
    }

    sharp.concurrency(1);

    try {
      const storageAdapter = await NcPluginMgrv2.storageAdapter();

      const { file, relativePath } = await this.getFileData(
        attachment,
        storageAdapter,
        scope,
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

      const sharpImage = sharp(file, {
        limitInputPixels: false,
      });

      for (const [size, thumbnailPath] of Object.entries(thumbnailPaths)) {
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

        const resizedImage = await sharpImage
          .resize(undefined, height, {
            fit: sharp.fit.cover,
            kernel: 'lanczos3',
          })
          .toBuffer();

        await (storageAdapter as any).fileCreateByStream(
          slash(thumbnailPath),
          Readable.from(resizedImage),
          {
            mimetype: 'image/jpeg',
          },
        );
      }

      return thumbnailPaths;
    } catch (error) {
      this.logger.error({
        message: `Failed to generate thumbnails for ${
          attachment.path ?? attachment.url
        }`,
        error: error?.message,
      });

      return null;
    }
  }

  private async getFileData(
    attachment: AttachmentResType,
    storageAdapter: IStorageAdapterV2,
    scope?: PublicAttachmentScope,
  ): Promise<{ file: Buffer; relativePath: string }> {
    let relativePath;

    if (attachment.path) {
      relativePath = path.join(
        'nc',
        scope ? '' : 'uploads',
        attachment.path.replace(/^download[/\\]/i, ''),
      );
    } else if (attachment.url) {
      relativePath = getPathFromUrl(attachment.url).replace(/^\/+/, '');
    }

    const file = await storageAdapter.fileRead(relativePath);

    const scopePath = scope ? scope : 'uploads';

    // remove everything before 'nc/${scopePath}/' (including nc/${scopePath}/) in relativePath
    relativePath = relativePath.replace(
      new RegExp(`^.*?nc[/\\\\]${scopePath}[/\\\\]`),
      '',
    );

    if (scope) {
      relativePath = `${scopePath}/${relativePath}`;
    }

    return { file, relativePath };
  }
}
