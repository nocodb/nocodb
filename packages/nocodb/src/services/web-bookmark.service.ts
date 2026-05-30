import path from 'path';
import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import slash from 'slash';
import { nanoid } from 'nanoid';
import hash from 'object-hash';
import dayjs from 'dayjs';
import mime from 'mime/lite';
import { OperationSource } from 'nocodb-sdk';
import type { NcContext, NcRequest } from 'nocodb-sdk';
import NcPluginMgrv2 from '~/helpers/NcPluginMgrv2';
import { NcError } from '~/helpers/catchError';
import { getFilteredAgents } from '~/utils/ssrf';

export interface WebBookmarkMetadata {
  url: string;
  title: string | null;
  description: string | null;
  faviconUrl: string | null;
  // Source og:image URL — the in-editor preview shown before the doc is saved
  // (no FileReference id yet). NOT a signed URL. Once saved, the image is served
  // via the cookie-authed doc attachment proxy keyed by FileReference id
  // (DocWebBookmarkNode → AttachmentProxyController) and this field is ignored.
  imageUrl: string | null;
  // Durable storage path of the cached copy. reconcileFileReferences turns this
  // into a FileReference (file_url) on doc save.
  imagePath: string | null;
  // Byte size of the cached image, recorded on the FileReference for workspace
  // storage accounting (0 when the source didn't report a Content-Length).
  fileSize: number | null;
  siteName: string | null;
  status: 'fetched' | 'fetch_failed';
}

const FETCH_TIMEOUT_MS = 10_000;
const MAX_HTML_BYTES = 1_000_000;
const MAX_IMAGE_BYTES = 5_000_000;
const MAX_URL_LENGTH = 2048;
// SVG intentionally excluded — fetched-from-anywhere SVG can carry inline
// <script>. See attachmentHelpers.ts for the same exclusion.
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
    // `badRequest` returns `never`, so `param.url` is narrowed to `string` here.
    const url = param.url.trim();
    if (url.length > MAX_URL_LENGTH) {
      ncError.badRequest(`URL exceeds maximum length of ${MAX_URL_LENGTH}`);
    }
    if (!/^https?:\/\//i.test(url)) {
      ncError.badRequest('Invalid URL — must start with http:// or https://');
    }

    const empty = (
      status: WebBookmarkMetadata['status'],
    ): WebBookmarkMetadata => ({
      url,
      title: null,
      description: null,
      faviconUrl: null,
      imageUrl: null,
      imagePath: null,
      fileSize: null,
      siteName: null,
      status,
    });

    let html = '';
    // Resolve relative og:image / favicon hrefs against the post-redirect URL —
    // shortened links (t.co, lnkd.in) would otherwise resolve against the wrong
    // origin. Mirrors AttachmentsService.uploadViaURL capturing responseUrl.
    let finalUrl = url;
    try {
      const res = await axios.get(url, {
        responseType: 'text',
        timeout: FETCH_TIMEOUT_MS,
        maxContentLength: MAX_HTML_BYTES,
        maxRedirects: 5,
        ...getFilteredAgents({ url, source: OperationSource.ATTACHMENTS }),
        headers: {
          accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'accept-language': 'en-US,en;q=0.9',
          'user-agent': USER_AGENT,
        },
        validateStatus: (s) => s >= 200 && s < 300,
      });
      html = String(res.data || '');
      finalUrl = res.request?.res?.responseUrl || url;
    } catch (e: any) {
      this.logger.error(
        `Web bookmark fetch failed for ${url}: ${e?.message ?? e}`,
      );
      return empty('fetch_failed');
    }

    const parsed = this.parseMetaTags(html, finalUrl);

    let imagePath: string | null = null;
    let fileSize: number | null = null;
    if (parsed.image) {
      const stored = await this.downloadAndStoreImage(
        parsed.image,
        param.req?.user?.id,
      );
      if (stored) {
        imagePath = stored.path;
        fileSize = stored.fileSize;
      }
    }

    return {
      url,
      title: parsed.title,
      description: parsed.description,
      faviconUrl: parsed.favicon,
      // Transient preview only — the source og:image URL. Durable serving is the
      // FileReference proxy (keyed by the id stamped on doc save).
      imageUrl: parsed.image,
      imagePath,
      fileSize,
      siteName: parsed.siteName,
      status: 'fetched',
    };
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
    // Try both quote styles and attribute orders. Capture the opening quote
    // (group 1) and backreference it, so a value containing the *other* quote
    // char (e.g. content="Bob's blog") isn't truncated. Content is group 2.
    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const patterns = [
      new RegExp(
        `<meta[^>]+${attr}=["']${escapedKey}["'][^>]*content=(["'])([\\s\\S]*?)\\1`,
        'i',
      ),
      new RegExp(
        `<meta[^>]+content=(["'])([\\s\\S]*?)\\1[^>]*${attr}=["']${escapedKey}["']`,
        'i',
      ),
    ];
    for (const re of patterns) {
      const m = re.exec(head);
      if (m && m[2]) return this.decodeEntities(m[2].trim());
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
      matches.find(
        (x) => /\bicon\b/.test(x.rel) && !/apple|mask/.test(x.rel),
      ) || matches[0];
    return this.resolveUrl(preferred.href, baseUrl);
  }

  private async downloadAndStoreImage(
    imageUrl: string,
    userId: string | undefined,
  ): Promise<{ path: string; fileSize: number } | null> {
    if (!/^https?:\/\//i.test(imageUrl)) return null;

    // HEAD first to validate the real Content-Type and enforce the size cap
    // before streaming the body — mirrors AttachmentsService.uploadViaURL.
    let headMime: string | null = null;
    let contentLength = 0;
    try {
      const head = await axios.head(imageUrl, {
        timeout: FETCH_TIMEOUT_MS,
        maxRedirects: 5,
        ...getFilteredAgents({
          url: imageUrl,
          source: OperationSource.ATTACHMENTS,
        }),
        headers: { 'user-agent': USER_AGENT },
        validateStatus: (s) => s >= 200 && s < 300,
      });
      headMime =
        (head.headers['content-type'] as string)
          ?.split(';')[0]
          ?.trim()
          ?.toLowerCase() || null;
      contentLength = +(head.headers['content-length'] || 0) || 0;
    } catch {
      // Some hosts reject HEAD — fall back to the URL extension for the MIME
      // check and let the storage adapter's maxContentLength cap the download.
    }

    // Prefer the server-reported MIME; fall back to the URL extension.
    const mimeType =
      headMime ||
      mime.getType(path.extname(this.urlPath(imageUrl)).slice(1)) ||
      null;
    if (mimeType && !ALLOWED_IMAGE_MIMES.has(mimeType)) {
      this.logger.warn(`Skipping non-image og:image MIME: ${mimeType}`);
      return null;
    }
    if (contentLength > MAX_IMAGE_BYTES) {
      this.logger.warn(
        `Skipping og:image exceeding ${MAX_IMAGE_BYTES} bytes (${contentLength})`,
      );
      return null;
    }

    try {
      const storageAdapter = await NcPluginMgrv2.storageAdapter();

      const ext =
        path.extname(this.urlPath(imageUrl)).toLowerCase().slice(1) ||
        (mimeType && mime.getExtension(mimeType)) ||
        'png';
      const userHash = hash(userId || 'anonymous');
      const dateDir = dayjs().format('YYYY/MM/DD');
      const fileName = `${nanoid(12)}.${ext}`;

      const relDir = path.join('web-bookmarks', dateDir, userHash);
      // Storage adapter expects the full path under nc/uploads/...
      const storageKey = slash(path.join('nc', 'uploads', relDir, fileName));

      const { url: hostedUrl } = await storageAdapter.fileCreateByUrl(
        storageKey,
        imageUrl,
        {
          fetchOptions: {
            buffer: false,
          },
        },
      );

      // FileReference is intentionally not inserted here — it's created later
      // by reconcileFileReferences on the next doc save, scoped to fk_doc_id.
      // This mirrors the image upload flow: storage write happens at upload
      // time, FileReference is materialized at save time, and the existing
      // AttachmentCleanUpProcessor handles GC of soft-deleted rows. Serving is
      // via the cookie-authed doc attachment proxy — never a backend-signed URL.
      const fileUrl = hostedUrl ?? path.join('download', relDir, fileName);

      return { path: fileUrl, fileSize: contentLength };
    } catch (e: any) {
      this.logger.error(
        `Web bookmark image download failed for ${imageUrl}: ${
          e?.message ?? e
        }`,
      );
      return null;
    }
  }

  private decodeEntities(s: string): string {
    // Decode a numeric code point, but leave control chars (incl. NUL — which
    // PG jsonb rejects) and lone surrogates undecoded, so a hostile og:title
    // can't inject a character that corrupts the doc content it lands in.
    const fromCp = (m: string, cp: number): string =>
      cp >= 0x20 && cp <= 0x10ffff && (cp < 0xd800 || cp > 0xdfff)
        ? String.fromCodePoint(cp)
        : m;
    return (
      s
        .replace(/&#x([0-9a-f]+);/gi, (m, hex) => fromCp(m, parseInt(hex, 16)))
        .replace(/&#(\d+);/g, (m, dec) => fromCp(m, parseInt(dec, 10)))
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&nbsp;/g, ' ')
        .replace(/&(?:rsquo|lsquo|apos);/g, "'")
        .replace(/&(?:rdquo|ldquo);/g, '"')
        .replace(/&mdash;/g, '—')
        .replace(/&ndash;/g, '–')
        .replace(/&hellip;/g, '…')
        // Decode &amp; last so "&amp;#39;" stays literal rather than double-decoding.
        .replace(/&amp;/g, '&')
    );
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
