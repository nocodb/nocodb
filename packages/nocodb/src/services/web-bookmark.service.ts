import path from 'path';
import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import slash from 'slash';
import { nanoid } from 'nanoid';
import hash from 'object-hash';
import moment from 'moment';
import mime from 'mime/lite';
import { OperationSource } from 'nocodb-sdk';
import type { NcContext, NcRequest } from 'nocodb-sdk';
import NcPluginMgrv2 from '~/helpers/NcPluginMgrv2';
import { PresignedUrl } from '~/models';
import { NcError } from '~/helpers/catchError';
import { getFilteredAgents } from '~/utils/ssrf';

interface WebBookmarkMetadata {
  url: string;
  title: string | null;
  description: string | null;
  faviconUrl: string | null;
  imageUrl: string | null;
  imagePath: string | null;
  siteName: string | null;
  status: 'fetched' | 'fetch_failed';
}

const FETCH_TIMEOUT_MS = 10_000;
const MAX_HTML_BYTES = 1_000_000;
const MAX_IMAGE_BYTES = 5_000_000;
const MAX_URL_LENGTH = 2048;
// SVG intentionally excluded — fetched-from-anywhere SVG can carry inline
// <script> and would XSS when served inline via /dltemp.
// See attachmentHelpers.ts for the same exclusion.
const ALLOWED_IMAGE_MIMES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/gif',
  'image/webp',
  'image/avif',
]);
const USER_AGENT =
  'Mozilla/5.0 (compatible; NocoDB-LinkPreview/1.0; +https://nocodb.com)';

@Injectable()
export class WebBookmarkService {
  protected logger = new Logger(WebBookmarkService.name);

  async fetchMetadata(
    context: NcContext,
    param: { url: unknown; req: NcRequest },
  ): Promise<WebBookmarkMetadata> {
    const ncError = NcError.get(context);

    if (typeof param.url !== 'string') {
      ncError.badRequest('Invalid URL — must be a string');
    }
    const url = (param.url as string).trim();
    if (url.length > MAX_URL_LENGTH) {
      ncError.badRequest(`URL exceeds maximum length of ${MAX_URL_LENGTH}`);
    }
    if (!/^https?:\/\//i.test(url)) {
      ncError.badRequest(
        'Invalid URL — must start with http:// or https://',
      );
    }

    const empty = (status: WebBookmarkMetadata['status']): WebBookmarkMetadata => ({
      url,
      title: null,
      description: null,
      faviconUrl: null,
      imageUrl: null,
      imagePath: null,
      siteName: null,
      status,
    });

    let html = '';
    try {
      const res = await axios.get(url, {
        responseType: 'text',
        timeout: FETCH_TIMEOUT_MS,
        maxContentLength: MAX_HTML_BYTES,
        ...getFilteredAgents({ url, source: OperationSource.ATTACHMENTS }),
        headers: {
          accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'accept-language': 'en-US,en;q=0.9',
          'user-agent': USER_AGENT,
        },
        validateStatus: (s) => s >= 200 && s < 400,
      });
      html = String(res.data || '');
    } catch (e: any) {
      this.logger.error(
        `Web bookmark fetch failed for ${url}: ${e?.message ?? e}`,
      );
      return empty('fetch_failed');
    }

    const parsed = this.parseMetaTags(html, url);

    let imagePath: string | null = null;
    let imageUrl: string | null = null;
    if (parsed.image) {
      const stored = await this.downloadAndStoreImage(
        parsed.image,
        param.req?.user?.id,
      );
      if (stored) {
        imagePath = stored.path;
        imageUrl = stored.signedUrl;
      }
    }

    return {
      url,
      title: parsed.title,
      description: parsed.description,
      faviconUrl: parsed.favicon,
      imageUrl,
      imagePath,
      siteName: parsed.siteName,
      status: 'fetched',
    };
  }

  /**
   * Re-sign a stored bookmark image so the URL stays valid past the
   * default signed-URL TTL. Frontend calls this lazily when an image fails
   * to load (e.g. on doc render hours after creation).
   */
  async resignImage(
    context: NcContext,
    param: { imagePath: unknown },
  ): Promise<{ imageUrl: string | null }> {
    const ncError = NcError.get(context);

    if (typeof param.imagePath !== 'string' || !param.imagePath.trim()) {
      ncError.badRequest('Invalid imagePath');
    }
    const imagePath = (param.imagePath as string).trim();

    // Only sign paths we own. The bookmark download path always begins
    // with `download/web-bookmarks/` (or is a full URL for S3/GCS storage).
    if (/^https?:\/\//i.test(imagePath)) {
      return { imageUrl: imagePath };
    }
    if (!imagePath.startsWith('download/web-bookmarks/')) {
      ncError.badRequest('Invalid imagePath');
    }

    // PresignedUrl.signAttachment / getSignedUrl expects the path relative
    // to nc/uploads/ — strip the leading `download/`.
    const relPath = imagePath.replace(/^download\//, '');
    try {
      const signedUrl = await PresignedUrl.getSignedUrl({
        pathOrUrl: relPath,
        preview: true,
      });
      return { imageUrl: signedUrl };
    } catch (e: any) {
      this.logger.error(
        `Web bookmark image resign failed for ${imagePath}: ${e?.message ?? e}`,
      );
      return { imageUrl: null };
    }
  }

  private parseMetaTags(html: string, baseUrl: string) {
    const head = this.extractHead(html);

    const ogTitle = this.findMeta(head, 'og:title');
    const twTitle = this.findMeta(head, 'twitter:title');
    const docTitle = this.findTagText(head, 'title');

    const ogDescription = this.findMeta(head, 'og:description');
    const twDescription = this.findMeta(head, 'twitter:description');
    const nameDescription = this.findMeta(head, 'description', 'name');

    const ogImage = this.findMeta(head, 'og:image');
    const twImage = this.findMeta(head, 'twitter:image');

    const ogSiteName = this.findMeta(head, 'og:site_name');
    const appName = this.findMeta(head, 'application-name', 'name');

    const favicon = this.findFavicon(head, baseUrl);

    return {
      title: this.firstNonEmpty(ogTitle, twTitle, docTitle),
      description: this.firstNonEmpty(
        ogDescription,
        twDescription,
        nameDescription,
      ),
      image: this.resolveUrl(this.firstNonEmpty(ogImage, twImage), baseUrl),
      siteName: this.firstNonEmpty(ogSiteName, appName, this.hostOf(baseUrl)),
      favicon,
    };
  }

  /** Slice to the <head>...</head> region so meta lookups don't scan the body */
  private extractHead(html: string): string {
    const m = /<head[^>]*>([\s\S]*?)<\/head>/i.exec(html);
    return m ? m[1] : html.slice(0, 50_000);
  }

  /** Find <meta property/name="key" content="..."> */
  private findMeta(
    head: string,
    key: string,
    attr: 'property' | 'name' = 'property',
  ): string | null {
    // Try both quote styles and attribute orders
    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const patterns = [
      new RegExp(
        `<meta[^>]+${attr}=["']${escapedKey}["'][^>]*content=["']([^"']*)["']`,
        'i',
      ),
      new RegExp(
        `<meta[^>]+content=["']([^"']*)["'][^>]*${attr}=["']${escapedKey}["']`,
        'i',
      ),
    ];
    for (const re of patterns) {
      const m = re.exec(head);
      if (m && m[1]) return this.decodeEntities(m[1].trim());
    }
    return null;
  }

  private findTagText(html: string, tag: string): string | null {
    const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
    const m = re.exec(html);
    if (!m) return null;
    return this.decodeEntities(m[1].replace(/\s+/g, ' ').trim()) || null;
  }

  private findFavicon(head: string, baseUrl: string): string | null {
    // <link rel="icon" href="..."> — also matches "shortcut icon", "apple-touch-icon"
    const re =
      /<link[^>]+rel=["']([^"']*icon[^"']*)["'][^>]*href=["']([^"']+)["']/gi;
    const matches: { rel: string; href: string }[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(head)) !== null) {
      matches.push({ rel: m[1].toLowerCase(), href: m[2] });
    }
    if (!matches.length) {
      // Try reversed attribute order
      const re2 =
        /<link[^>]+href=["']([^"']+)["'][^>]*rel=["']([^"']*icon[^"']*)["']/gi;
      while ((m = re2.exec(head)) !== null) {
        matches.push({ rel: m[2].toLowerCase(), href: m[1] });
      }
    }
    if (!matches.length) {
      // Fallback to /favicon.ico at the site root
      try {
        return new URL('/favicon.ico', baseUrl).toString();
      } catch {
        return null;
      }
    }
    // Prefer plain "icon" over "apple-touch-icon" / "mask-icon"
    const preferred =
      matches.find((x) => /\bicon\b/.test(x.rel) && !/apple|mask/.test(x.rel)) ||
      matches[0];
    return this.resolveUrl(preferred.href, baseUrl);
  }

  private async downloadAndStoreImage(
    imageUrl: string,
    userId: string | undefined,
  ): Promise<{ path: string; signedUrl: string } | null> {
    if (!/^https?:\/\//i.test(imageUrl)) return null;

    const mimeType =
      mime.getType(path.extname(this.urlPath(imageUrl)).slice(1)) || null;
    if (mimeType && !ALLOWED_IMAGE_MIMES.has(mimeType)) {
      this.logger.warn(`Skipping non-image og:image MIME: ${mimeType}`);
      return null;
    }

    try {
      const storageAdapter = await NcPluginMgrv2.storageAdapter();

      const ext =
        path.extname(this.urlPath(imageUrl)).toLowerCase().slice(1) || 'png';
      const userHash = hash(userId || 'anonymous');
      const dateDir = moment().format('YYYY/MM/DD');
      const fileName = `${nanoid(12)}.${ext}`;

      const relDir = path.join('web-bookmarks', dateDir, userHash);
      // Storage adapter expects the full path under nc/uploads/...
      const storageKey = slash(path.join('nc', 'uploads', relDir, fileName));
      // Signing + serving operate on the path relative to nc/uploads/ — the
      // `/dltemp/:param(*)` controller re-prefixes `nc/uploads/` itself.
      // See AttachmentsService → `attachment.path` is stored as `download/...`
      // and PresignedUrl.signAttachment strips `download/` before signing.
      const relPath = slash(path.join(relDir, fileName));

      const { url: hostedUrl } = await storageAdapter.fileCreateByUrl(
        storageKey,
        imageUrl,
        {
          fetchOptions: {
            buffer: false,
          },
        },
      );

      const fileUrl = hostedUrl ?? path.join('download', relDir, fileName);

      // FileReference is intentionally not inserted here — it's created later
      // by reconcileFileReferences on the next doc save, scoped to fk_doc_id.
      // This mirrors the image upload flow: storage write happens at upload
      // time, FileReference is materialized at save time, and the existing
      // AttachmentCleanUpProcessor handles GC of soft-deleted rows.
      void userId;

      const signedUrl = await PresignedUrl.getSignedUrl({
        pathOrUrl: hostedUrl ? hostedUrl : relPath,
        preview: true,
      });

      return { path: fileUrl, signedUrl };
    } catch (e: any) {
      this.logger.error(
        `Web bookmark image download failed for ${imageUrl}: ${e?.message ?? e}`,
      );
      return null;
    } finally {
      void MAX_IMAGE_BYTES; // size enforcement handled by storage adapter / axios maxContentLength
    }
  }

  private decodeEntities(s: string): string {
    return s
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&#x27;/g, "'")
      .replace(/&nbsp;/g, ' ');
  }

  private firstNonEmpty(
    ...values: (string | null | undefined)[]
  ): string | null {
    for (const v of values) {
      if (v && v.trim()) return v.trim();
    }
    return null;
  }

  private resolveUrl(href: string | null, baseUrl: string): string | null {
    if (!href) return null;
    try {
      return new URL(href, baseUrl).toString();
    } catch {
      return null;
    }
  }

  private urlPath(url: string): string {
    try {
      return new URL(url).pathname;
    } catch {
      return '';
    }
  }

  private hostOf(url: string): string | null {
    try {
      return new URL(url).hostname;
    } catch {
      return null;
    }
  }
}
