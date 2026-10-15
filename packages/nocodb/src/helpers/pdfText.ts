import { Logger } from '@nestjs/common';
import { getDocumentProxy } from 'unpdf';

const logger = new Logger('pdfText');

// Bounds work on hostile or huge uploads; text past this page is dropped.
export const PDF_MAX_PAGES = 500;

export const extractPdfText = async (
  data: Buffer,
  { maxPages = PDF_MAX_PAGES }: { maxPages?: number } = {},
): Promise<string> => {
  // unpdf bundles a current pdf.js, which interprets PostScript functions
  // instead of compiling them with `new Function`. pdf.js detaches the
  // buffer it is given, so pass a copy.
  const pdf = await getDocumentProxy(new Uint8Array(data));

  try {
    const pageCount = Math.min(pdf.numPages, maxPages);
    const pages: string[] = [];

    for (let i = 1; i <= pageCount; i++) {
      // A corrupt page yields '' so the readable pages still come through.
      try {
        const page = await pdf.getPage(i);
        try {
          const content = await page.getTextContent();
          pages.push(
            content.items
              .map((item) =>
                'str' in item ? item.str + (item.hasEOL ? '\n' : '') : '',
              )
              .join(''),
          );
        } finally {
          page.cleanup();
        }
      } catch (e) {
        logger.debug(`Skipping unreadable PDF page ${i}: ${e?.message ?? e}`);
        pages.push('');
      }
    }

    return pages.join('\n');
  } finally {
    await pdf.loadingTask.destroy();
  }
};
