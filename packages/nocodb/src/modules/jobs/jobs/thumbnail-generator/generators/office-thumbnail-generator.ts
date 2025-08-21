import { promisify } from 'util';
import { exec } from 'child_process';
import path from 'path';
import os from 'os';
import fs from 'fs/promises';
import { BaseThumbnailGenerator } from '~/modules/jobs/jobs/thumbnail-generator/generators/base-thumbnail-generator';

/**
 * Office document thumbnail generator for DOCX, DOC, XLSX, PPTX, etc.
 */
export class OfficeDocumentThumbnailGenerator extends BaseThumbnailGenerator {
  private execAsync = promisify(exec);

  protected async generateThumbnailBuffer(file: Buffer): Promise<Buffer> {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'doc-thumbnail-'));
    const fileExt = await this.detectFileExtension(file);
    const inputPath = path.join(tempDir, `input${fileExt}`);

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

      // Find the output file
      const outputFileName = path.basename(inputPath, fileExt) + '.png';
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

  private async detectFileExtension(buffer: Buffer): Promise<string> {
    // More robust file type detection
    const header = buffer.toString('hex', 0, 16);

    // ZIP-based formats (Office 2007+)
    if (buffer.toString('ascii', 0, 2) === 'PK') {
      try {
        const content = buffer.toString('ascii', 0, 2000);
        if (content.includes('word/document.xml')) return '.docx';
        if (content.includes('xl/workbook.xml')) return '.xlsx';
        if (content.includes('ppt/presentation.xml')) return '.pptx';
      } catch {
        return '.docx'; // Default for ZIP files
      }
    }

    // Legacy Office formats
    if (header.startsWith('d0cf11e0a1b11ae1')) {
      return '.doc'; // Could also be .xls or .ppt, but .doc is most common
    }

    // RTF
    if (buffer.toString('ascii', 0, 5) === '{\\rtf') {
      return '.rtf';
    }

    // OpenDocument formats
    if (buffer.toString('ascii', 0, 2) === 'PK') {
      const content = buffer.toString('ascii', 0, 1000);
      if (content.includes('manifest.xml') && content.includes('odt'))
        return '.odt';
      if (content.includes('manifest.xml') && content.includes('ods'))
        return '.ods';
      if (content.includes('manifest.xml') && content.includes('odp'))
        return '.odp';
    }

    return '.docx'; // Safe default
  }
}
