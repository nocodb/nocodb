import { Injectable, Logger } from '@nestjs/common';
import {
  NC_STORE_KEY_WHITE_LABEL,
  type WhiteLabelConfig,
} from 'nocodb-sdk';
import Store from '~/models/Store';
import { NcError } from '~/helpers/catchError';
import { PresignedUrl } from '~/models';
import type { NcRequest } from '~/interface/config';

const HEX_COLOR_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const MAX_PRODUCT_NAME_LEN = 60;
const MAX_SENDER_NAME_LEN = 60;
const MAX_FOOTER_TEXT_LEN = 240;
// Accepted shapes for an asset URL field:
//   - absolute http(s) URL  (external CDN)
//   - same-origin path starting with /  (manually pasted)
//   - canonical attachment path "download/<scope>/..." produced by the uploader
//     (re-signed at read time in `getPublicConfig`)
// Anything else is rejected to block javascript:, data: URIs, etc.
const URL_RE =
  /^(https?:\/\/[^\s]+|\/[^\s]*|download\/[^\s]+)$/;
// Email footer URL must be absolute http(s) — these links are resolved from
// inboxes, not the app, so same-origin paths don't apply.
const ABSOLUTE_URL_RE = /^https?:\/\/[^\s]+$/;
// One-hour signed URLs are short enough to misbehave if the appInfo response
// is cached; one week is the longest signing window the existing utility
// supports without expiry surprises.
const ASSET_URL_EXPIRE_SECONDS = 7 * 24 * 60 * 60;

const DEFAULT_CONFIG: WhiteLabelConfig = {
  enabled: false,
  productName: null,
  logoUrl: null,
  logoDarkUrl: null,
  faviconUrl: null,
  brandColor: null,
  email: null,
};

@Injectable()
export class WhiteLabelService {
  protected logger = new Logger(WhiteLabelService.name);

  private cache: WhiteLabelConfig | null = null;

  /** Canonical form, untouched URLs — for internal use only. */
  private async getRawConfig(): Promise<WhiteLabelConfig> {
    if (this.cache) return this.cache;

    const row = await Store.get(NC_STORE_KEY_WHITE_LABEL, true);
    if (!row?.value) {
      this.cache = { ...DEFAULT_CONFIG };
      return this.cache;
    }

    try {
      const parsed = JSON.parse(row.value);
      this.cache = { ...DEFAULT_CONFIG, ...parsed };
    } catch (e) {
      this.logger.error(
        `Failed to parse white-label config: ${(e as Error).message}`,
        (e as Error).stack,
      );
      this.cache = { ...DEFAULT_CONFIG };
    }
    return this.cache;
  }

  /**
   * Admin-facing config — same as getRawConfig but with canonical attachment
   * paths re-signed so the admin UI can render previews and PUT the same
   * value back without re-uploading.
   */
  async getConfig(): Promise<WhiteLabelConfig> {
    const cfg = await this.getRawConfig();
    return {
      ...cfg,
      logoUrl: await this.resolveAssetUrl(cfg.logoUrl),
      logoDarkUrl: await this.resolveAssetUrl(cfg.logoDarkUrl),
      faviconUrl: await this.resolveAssetUrl(cfg.faviconUrl),
    };
  }

  /**
   * Sanitized view for unauthenticated callers — strips fields when the
   * config is disabled so the login page doesn't leak prepared-but-not-yet-
   * enabled branding. Canonical attachment paths (`download/...`) are
   * re-signed every call so the frontend always gets a fresh, working URL.
   */
  async getPublicConfig(): Promise<WhiteLabelConfig | null> {
    const cfg = await this.getRawConfig();
    if (!cfg.enabled) return null;
    return {
      ...cfg,
      logoUrl: await this.resolveAssetUrl(cfg.logoUrl),
      logoDarkUrl: await this.resolveAssetUrl(cfg.logoDarkUrl),
      faviconUrl: await this.resolveAssetUrl(cfg.faviconUrl),
    };
  }

  /**
   * Convert a stored URL/path into something the browser can fetch.
   * Raw attachment paths (`download/<scope>/...`) get signed into a
   * `/dltemp/...` URL; everything else (absolute URL, `/`-prefixed path)
   * is passed through unchanged.
   *
   * Legacy values may still be stale `/dltemp/...` URLs from an earlier
   * iteration — try to recover the canonical path and re-sign.
   */
  private async resolveAssetUrl(value: string | null | undefined) {
    if (!value) return value ?? null;

    let canonical: string | null = null;

    if (value.startsWith('download/')) {
      canonical = value;
    } else if (value.startsWith('/dltemp/') || value.startsWith('dltemp/')) {
      const recovered =
        (await PresignedUrl.getPath(value)) ??
        (await PresignedUrl.getPath(value.replace(/^\//, '')));
      if (recovered) {
        canonical = recovered.startsWith('download/')
          ? recovered
          : `download/${recovered}`;
      } else {
        // URL is stale and cache doesn't know it — there's no way to recover.
        return null;
      }
    } else {
      return value;
    }

    const attachment: { path: string; mimetype: string; signedPath?: string } = {
      path: canonical,
      // Mimetype here is only used by `isPreviewAllowed` to decide if the
      // signed URL renders inline vs forces download. We always want inline
      // for branding assets, so pass a permissive image mimetype.
      mimetype: 'image/png',
    };
    try {
      await PresignedUrl.signAttachment({
        attachment,
        expireSeconds: ASSET_URL_EXPIRE_SECONDS,
      });
    } catch (e) {
      this.logger.error(
        `Failed to sign white-label asset ${canonical}: ${(e as Error).message}`,
        (e as Error).stack,
      );
      return null;
    }
    if (!attachment.signedPath) return null;
    // Local storage builds `dltemp/...` without a leading slash. Anything an
    // `<img src>` consumes needs an absolute same-origin path, otherwise the
    // browser resolves it relative to the current route.
    return /^(https?:\/\/|\/)/.test(attachment.signedPath)
      ? attachment.signedPath
      : `/${attachment.signedPath}`;
  }

  async updateConfig(
    body: Partial<WhiteLabelConfig>,
    _req: NcRequest,
  ): Promise<WhiteLabelConfig> {
    const next: WhiteLabelConfig = {
      ...(await this.getRawConfig()),
      ...body,
    };

    // Convert preview URLs back to canonical paths before persistence so the
    // saved value doesn't expire. `/dltemp/...` signed URLs that have rolled
    // out of the cache fall through to validation, which will reject them
    // with a clear "re-upload" message.
    next.logoUrl = await this.canonicalizeAssetUrl(next.logoUrl);
    next.logoDarkUrl = await this.canonicalizeAssetUrl(next.logoDarkUrl);
    next.faviconUrl = await this.canonicalizeAssetUrl(next.faviconUrl);

    this.validate(next);

    await Store.saveOrUpdate({
      key: NC_STORE_KEY_WHITE_LABEL,
      value: JSON.stringify(next),
      type: 'object',
    });

    this.cache = next;
    // Return the admin-facing form so the UI can keep rendering previews
    // (canonical paths get re-signed here too).
    return this.getConfig();
  }

  /** Reverse of resolveAssetUrl — only touches `/dltemp/...` signed URLs. */
  private async canonicalizeAssetUrl(value: string | null | undefined) {
    if (!value) return value ?? null;
    // Tolerate any signed URL by detecting the `dltemp` segment anywhere in
    // the value — the leading slash and the `?expireAt=...` query are both
    // optional from the client's perspective.
    const dltempIdx = value.indexOf('dltemp/');
    if (dltempIdx === -1) return value;
    // Strip the query string before cache lookup — `add()` keyed the cache by
    // the URL without query, but the value coming back from `getConfig` always
    // has query params appended.
    const urlNoQuery = value.split('?')[0];
    // `PresignedUrl.add` keys the cache by the full URL including any leading
    // slash, so try both shapes.
    let canonical =
      (await PresignedUrl.getPath(urlNoQuery)) ??
      (await PresignedUrl.getPath(urlNoQuery.replace(/^\//, '')));
    if (!canonical) {
      NcError.badRequest(
        'Uploaded asset URL has expired — please re-upload the file.',
      );
    }
    // PresignedUrl returns the cached `path` which carries the original query
    // string (`?expireAt=...&...`). Drop it before storage; we re-sign on read.
    canonical = canonical.split('?')[0];
    // PresignedUrl strips the `download/` prefix before signing, so the
    // recovered canonical doesn't include it. Add it back to match the shape
    // `attachment.path` originally had.
    return canonical.startsWith('download/')
      ? canonical
      : `download/${canonical}`;
  }

  private validate(cfg: WhiteLabelConfig) {
    if (typeof cfg.enabled !== 'boolean') {
      NcError.badRequest('`enabled` must be a boolean');
    }

    if (cfg.productName != null) {
      if (typeof cfg.productName !== 'string') {
        NcError.badRequest('`productName` must be a string');
      }
      if (cfg.productName.length > MAX_PRODUCT_NAME_LEN) {
        NcError.badRequest(
          `\`productName\` must be ${MAX_PRODUCT_NAME_LEN} characters or fewer`,
        );
      }
    }

    for (const key of ['logoUrl', 'logoDarkUrl', 'faviconUrl'] as const) {
      const v = cfg[key];
      if (v != null) {
        if (typeof v !== 'string' || !URL_RE.test(v)) {
          NcError.badRequest(
            `\`${key}\` must be an http(s) URL or a same-origin path starting with /`,
          );
        }
      }
    }

    if (cfg.brandColor != null) {
      if (typeof cfg.brandColor !== 'string' || !HEX_COLOR_RE.test(cfg.brandColor)) {
        NcError.badRequest('`brandColor` must be a hex color like #0D5A5A');
      }
    }

    if (cfg.email != null) {
      if (typeof cfg.email !== 'object' || Array.isArray(cfg.email)) {
        NcError.badRequest('`email` must be an object');
      }
      const { senderName, footerText, footerUrl } = cfg.email;
      if (senderName != null) {
        if (typeof senderName !== 'string') {
          NcError.badRequest('`email.senderName` must be a string');
        }
        if (senderName.length > MAX_SENDER_NAME_LEN) {
          NcError.badRequest(
            `\`email.senderName\` must be ${MAX_SENDER_NAME_LEN} characters or fewer`,
          );
        }
      }
      if (footerText != null) {
        if (typeof footerText !== 'string') {
          NcError.badRequest('`email.footerText` must be a string');
        }
        if (footerText.length > MAX_FOOTER_TEXT_LEN) {
          NcError.badRequest(
            `\`email.footerText\` must be ${MAX_FOOTER_TEXT_LEN} characters or fewer`,
          );
        }
      }
      if (footerUrl != null) {
        if (typeof footerUrl !== 'string' || !ABSOLUTE_URL_RE.test(footerUrl)) {
          NcError.badRequest('`email.footerUrl` must be an http(s) URL');
        }
      }
    }
  }
}
