import path from 'path';
import { Readable } from 'stream';
import { Logger } from '@nestjs/common';
import slash from 'slash';
import type { IStorageAdapterV2 } from '~/types/nc-plugin';
import Noco from '~/Noco';

// Cap on input pixels (width * height) for thumbnail generation, to stop a huge
// or decompression-bomb image from OOM-killing the (<1 GB) worker — which, with
// the previous `limitInputPixels: false`, allocated gigabytes of raw raster and
// requeued the job into a crash loop.
//
// The cap is format-aware because peak memory depends heavily on the codec:
//  - JPEG/WEBP support shrink-on-load, so libvips decodes a large image at a
//    reduced scale when resizing down to a thumbnail — peak memory stays small
//    regardless of input MP. These get a generous cap so legit large photos
//    (48 MP phones, DSLRs, panoramas) still get thumbnails.
//  - Everything else (PNG, TIFF, BMP, HEIC, GIF, ...) is fully decoded to
//    `pixels * channels` bytes, so it gets a tight cap that bounds the worst
//    case to ~100 MB (RGBA) and leaves headroom for the source buffer + Node.
//
// Both are overridable via env.
const SHRINK_ON_LOAD_FORMATS = new Set(['jpeg', 'jpg', 'webp']);

const MAX_INPUT_PIXELS_SHRINKABLE =
  +process.env.NC_THUMBNAIL_MAX_INPUT_PIXELS_SHRINKABLE || 100 * 1000 * 1000;

const MAX_INPUT_PIXELS_FULL_DECODE =
  +process.env.NC_THUMBNAIL_MAX_INPUT_PIXELS || 24 * 1000 * 1000;

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

      // Reject oversized images up front. `metadata()` only parses the header
      // (no full decode), so this is cheap and lets us skip gracefully instead
      // of letting sharp allocate the full raster and OOM the worker.
      let metadata;
      try {
        metadata = await sharp(thumbnailBuffer, {
          limitInputPixels: false,
        }).metadata();
      } catch (e) {
        this.logger.warn({
          message: `Skipping thumbnails: unreadable image for ${relativePath}`,
          error: e?.message,
        });
        return null;
      }

      const inputPixels = (metadata.width ?? 0) * (metadata.height ?? 0);
      const maxInputPixels = SHRINK_ON_LOAD_FORMATS.has(metadata.format)
        ? MAX_INPUT_PIXELS_SHRINKABLE
        : MAX_INPUT_PIXELS_FULL_DECODE;
      if (inputPixels > maxInputPixels) {
        this.logger.warn({
          message: `Skipping thumbnails: image ${metadata.width}x${metadata.height} (${inputPixels}px, ${metadata.format}) exceeds cap ${maxInputPixels}px`,
          relativePath,
        });
        return null;
      }

      // Finite `limitInputPixels` backstops the metadata check above (e.g. if the
      // header under-reports dimensions) so the decode itself can't run unbounded.
      const sharpImage = sharp(thumbnailBuffer, {
        limitInputPixels: maxInputPixels,
      });

      // `.rotate()` with no arguments auto-applies the EXIF orientation and drops
      // the tag, baking the rotation into the pixels. sharp does not auto-orient
      // and strips metadata from output by default, so without this thumbnails of
      // photos carrying an EXIF orientation render rotated. See nocodb/nocodb#10289.
      // Only invoke it for a non-identity orientation: orientation 1 (or absent)
      // needs no rotation, so skipping the call keeps the pipeline minimal and
      // avoids any chance of `useExifOrientation` disabling shrink-on-load for the
      // common (un-rotated) case.
      if (metadata.orientation && metadata.orientation !== 1) {
        sharpImage.rotate();
      }

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

        // clone() per size so each output gets an independent pipeline snapshot
        // (inheriting the rotate above) rather than mutating the shared instance.
        const resizedImage = await sharpImage
          .clone()
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
