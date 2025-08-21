import { renderPageAsImage } from 'unpdf';
import { BaseThumbnailGenerator } from '~/modules/jobs/jobs/thumbnail-generator/generators/base-thumbnail-generator';
import Noco from '~/Noco';

export class PdfThumbnailGenerator extends BaseThumbnailGenerator {
  /**
   * Generate thumbnail buffer from PDF using unpdf
   */
  protected async generateThumbnailBuffer(file: Buffer): Promise<Buffer> {
    const imageBuffer = await renderPageAsImage(
      new Uint8Array(file),
      1, // First page
      {
        canvasImport: () => Noco.canvas,
        scale: 4.0,
      },
    );

    return Buffer.from(imageBuffer);
  }
}
