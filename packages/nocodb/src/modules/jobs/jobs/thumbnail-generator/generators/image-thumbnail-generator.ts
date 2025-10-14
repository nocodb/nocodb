import { BaseThumbnailGenerator } from '~/modules/jobs/jobs/thumbnail-generator/generators/base-thumbnail-generator';

export class ImageThumbnailGenerator extends BaseThumbnailGenerator {
  /**
   * For images, we can use the original file buffer directly
   */
  protected async generateThumbnailBuffer(file: Buffer): Promise<Buffer> {
    return file;
  }
}
