import path from 'path';
import { Readable } from 'stream';
import { Logger } from '@nestjs/common';
import slash from 'slash';
import type { IStorageAdapterV2 } from '~/types/nc-plugin';
import Noco from '~/Noco';

export abstract class BaseThumbnailGenerator {
  protected logger = new Logger(this.constructor.name);

  /**
   * Generate the thumbnail buffer - implemented by subclasses
   */
  protected abstract generateThumbnailBuffer(file: Buffer): Promise<Buffer>;

  /**
   * Generate thumbnails for the given file
   */
  async generateThumbnails(
    file: Buffer,
    relativePath: string,
    storageAdapter: IStorageAdapterV2,
  ): Promise<{ [key: string]: string } | null> {
    try {
      // Get the thumbnail buffer from the subclass
      const thumbnailBuffer = await this.generateThumbnailBuffer(file);

      const sharp = Noco.sharp;

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

      const sharpImage = sharp(thumbnailBuffer, { limitInputPixels: false });

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
          .jpeg({ quality: 80 })
          .toBuffer();

        await (storageAdapter as any).fileCreateByStream(
          slash(thumbnailPath),
          Readable.from(resizedImage),
          { mimetype: 'image/jpeg' },
        );
      }

      return thumbnailPaths;
    } catch (error) {
      this.logger.error({
        message: `Failed to generate thumbnails for ${relativePath}`,
        error: error?.message,
      });
      return null;
    }
  }
}
