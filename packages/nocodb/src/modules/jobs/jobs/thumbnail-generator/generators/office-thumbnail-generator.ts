import { promisify } from 'util';
import { exec } from 'child_process';
import path from 'path';
import os from 'os';
import fs from 'fs/promises';
import { BaseThumbnailGenerator } from '~/modules/jobs/jobs/thumbnail-generator/generators/base-thumbnail-generator';

/**
 * Office document thumbnail generator for DOCX, DOC, XLSX, PPTX, etc.
 * Uses LibreOffice's built-in format detection instead of manual file type detection.
 */
export class OfficeDocumentThumbnailGenerator extends BaseThumbnailGenerator {
  private execAsync = promisify(exec);

  protected async generateThumbnailBuffer(file: Buffer): Promise<Buffer> {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'doc-thumbnail-'));
    const uniqueId = Math.random().toString(36).substring(2, 15);
    const inputFileName = `input-${uniqueId}`;
    const inputPath = path.join(tempDir, inputFileName);

    try {
      await fs.writeFile(inputPath, file);

      // Convert with specific options for thumbnails
      const command = [
        'soffice',
        '--headless',
        '--invisible',
        '--nodefault',
        '--nolockcheck',
        '--nologo',
        '--norestore',
        '--convert-to',
        'png',
        '--outdir',
        `"${tempDir}"`,
        `"${inputPath}"`,
      ].join(' ');

      this.logger.debug(`Executing LibreOffice command: ${command}`);

      const { stdout: _, stderr } = await this.execAsync(command, {
        timeout: 30000,
        maxBuffer: 1024 * 1024, // 1MB buffer
      });

      if (stderr && !stderr.includes('Warning')) {
        this.logger.warn(`LibreOffice stderr: ${stderr}`);
      }

      // Find the output file - LibreOffice creates PNG with same base name
      const outputFileName = `${inputFileName}.png`;
      const outputPath = path.join(tempDir, outputFileName);

      // Verify output file exists
      await fs.access(outputPath);
      return await fs.readFile(outputPath);
    } catch (error) {
      this.logger.error(`LibreOffice conversion failed: ${error.message}`);
      throw error;
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  }
}
