import path from 'path';
import { Logger } from '@nestjs/common';
import type { IStorageAdapterV2 } from '~/types/nc-plugin';
import type { Job } from 'bull';
import type { AttachmentResType, PublicAttachmentScope } from 'nocodb-sdk';
import type { ThumbnailGeneratorJobData } from '~/interface/Jobs';
import NcPluginMgrv2 from '~/helpers/NcPluginMgrv2';
import { getPathFromUrl } from '~/helpers/attachmentHelpers';
import { ImageThumbnailGenerator } from '~/modules/jobs/jobs/thumbnail-generator/generators/image-thumbnail-generator';
// import { PdfThumbnailGenerator } from '~/modules/jobs/jobs/thumbnail-generator/generators/pdf-thumbnail-generator';
import Noco from '~/Noco';

export class ThumbnailGeneratorProcessor {
  private logger = new Logger(ThumbnailGeneratorProcessor.name);
  private imageGenerator = new ImageThumbnailGenerator();
  // private pdfGenerator = new PdfThumbnailGenerator();

  async job(job: Job<ThumbnailGeneratorJobData>) {
    const { attachments, scope } = job.data;

    const results = [];

    const sharp = Noco.sharp;

    if (!sharp) {
      this.logger.warn('Sharp not available, skipping thumbnail generation');
      return results;
    }

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

    try {
      const storageAdapter = await NcPluginMgrv2.storageAdapter();
      const { file, relativePath } = await this.getFileData(
        attachment,
        storageAdapter,
        scope,
      );

      const mimeType = attachment.mimetype || '';
      const fileExtension = attachment.title?.toLowerCase() || '';

      switch (true) {
        case mimeType === 'application/pdf' || fileExtension.endsWith('.pdf'): {
          // if (Noco.isPdfjsInitialized && Noco.canvas)
          //   return await this.pdfGenerator.generateThumbnails(
          //     file,
          //     relativePath,
          //     storageAdapter,
          //   );
          return null;
        }

        case mimeType.startsWith('image/'):
          return await this.imageGenerator.generateThumbnails(
            file,
            relativePath,
            storageAdapter,
          );
        default:
          this.logger.warn({
            message: `Unknown file type, skipping thumbnail generation`,
            mimetype: mimeType,
            filename: attachment.title,
          });
          return null;
      }
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
