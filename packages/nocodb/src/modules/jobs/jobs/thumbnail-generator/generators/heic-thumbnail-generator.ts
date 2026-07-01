import convert from 'heic-convert';
import { BaseThumbnailGenerator } from '~/modules/jobs/jobs/thumbnail-generator/generators/base-thumbnail-generator';

export class HeicThumbnailGenerator extends BaseThumbnailGenerator {
  /**
   * HEIC/HEIF use the HEVC codec, which the prebuilt libvips bundled with sharp
   * cannot decode. Convert to a full-resolution JPEG first; the base class then
   * runs the normal sharp resize/encode pipeline on that JPEG.
   */
  protected async generateThumbnailBuffer(file: Buffer): Promise<Buffer> {
    const jpeg = await convert({ buffer: file, format: 'JPEG', quality: 0.92 });
    return Buffer.from(jpeg);
  }

  /**
   * Browsers (except Safari) can't render the original `.heic`, so the
   * full-screen preview falls back to a server-generated rendition. Produce it
   * at the original resolution (capped only to bound pathological inputs, never
   * upscaled, near-lossless quality) so the preview — and any image the user
   * saves from it — matches the original instead of a downscaled thumbnail.
   */
  protected getThumbnailSizes() {
    return {
      ...super.getThumbnailSizes(),
      preview: { maxEdge: 4096, quality: 90 },
    };
  }
}
