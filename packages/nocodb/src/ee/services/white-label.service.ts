import path from 'path';
import { createHash } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import {
  AppEvents,
  NC_STORE_KEY_WHITE_LABEL,
  PlanFeatureTypes,
  type WhiteLabelConfig,
} from 'nocodb-sdk';
import type { NcRequest } from '~/interface/config';
import Store from '~/models/Store';
import Noco from '~/Noco';
import { NcError } from '~/helpers/catchError';
import { PresignedUrl } from '~/models';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { getOnPremPlan } from '~/helpers/paymentHelpers';
import NcPluginMgrv2 from '~/helpers/NcPluginMgrv2';
import { ncSiteUrl } from '~/utils/envs';
import { NC_EMAIL_ASSETS_BASE_URL } from '~/constants';
import { validateAndNormaliseLocalPath } from '~/helpers/attachmentHelpers';

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
const URL_RE = /^(https?:\/\/[^\s]+|\/[^\s]*|download\/[^\s]+)$/;
// White-label assets are brand IMAGES served same-origin and rendered inline,
// so ANY non-image upload (.svg/.html/.xhtml/.xml/.js …) is a stored-XSS
// vector. Enforce a POSITIVE raster-image extension allowlist — the previous
// denylist matched only `.svg`/`.svgz`, leaving `.html`/`.xhtml` (served as
// text/html) wide open. We allowlist by EXTENSION, not MIME, on purpose:
// `.ico` has no reliable MIME (mime/lite returns null and it's excluded from
// `imageMimeTypes` / `isPreviewAllowed`), so a MIME-based allowlist would
// wrongly reject favicons.
const ALLOWED_ASSET_EXT_RE = /\.(png|jpe?g|ico|gif|webp|avif|apng|bmp)$/i;
// Fixed extension → image content-type map. Used at serve time so the response
// content-type is NEVER derived from the value's real type (e.g. a legacy
// `.html` row must not be served as text/html).
const ASSET_CONTENT_TYPE: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  ico: 'image/x-icon',
  gif: 'image/gif',
  webp: 'image/webp',
  avif: 'image/avif',
  apng: 'image/apng',
  bmp: 'image/bmp',
};
// Lowercased trailing extension of an asset value (query/fragment stripped),
// or '' when there is none.
function assetExt(value: string): string {
  const clean = value.split(/[?#]/)[0];
  const dot = clean.lastIndexOf('.');
  return dot === -1 ? '' : clean.slice(dot + 1).toLowerCase();
}
// Email footer URL must be absolute http(s) — these links are resolved from
// inboxes, not the app, so same-origin paths don't apply.
const ABSOLUTE_URL_RE = /^https?:\/\/[^\s]+$/;
// Pragmatic email check (not RFC-perfect) for the support-contact address.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_SUPPORT_EMAIL_LEN = 254;
// One-hour signed URLs are short enough to misbehave if the appInfo response
// is cached; one week is the longest signing window the existing utility
// supports without expiry surprises.
const ASSET_URL_EXPIRE_SECONDS = 7 * 24 * 60 * 60;

// Asset types served by the stable public endpoint (`/api/v2/meta/white-label/
// asset/:type`) → the config field each maps to. The form banner is NOT here:
// it only renders in-product on a live page, so it keeps the signed URL.
const PUBLIC_ASSET_FIELDS = {
  logo: 'logoUrl',
  logoDark: 'logoDarkUrl',
  favicon: 'faviconUrl',
} as const;
type PublicAssetType = keyof typeof PUBLIC_ASSET_FIELDS;

const DEFAULT_CONFIG: WhiteLabelConfig = {
  enabled: false,
  productName: null,
  logoUrl: null,
  logoDarkUrl: null,
  faviconUrl: null,
  brandColor: null,
  formBannerUrl: null,
  supportEmail: null,
  email: null,
};

@Injectable()
export class WhiteLabelService {
  protected logger = new Logger(WhiteLabelService.name);

  constructor(protected readonly appHooksService: AppHooksService) {}

  /**
   * Canonical form, untouched URLs — for internal use only.
   *
   * Reads through `Store.get(..., lookInCache=true)` which is backed by
   * NocoCache (Redis when configured). `Store.saveOrUpdate` busts that key on
   * write, so every node sees fresh config — no per-process cache that would go
   * stale across a horizontally-scaled deployment.
   */
  private async getRawConfig(): Promise<WhiteLabelConfig> {
    const row = await Store.get(NC_STORE_KEY_WHITE_LABEL, true);
    if (!row?.value) return { ...DEFAULT_CONFIG };

    try {
      const parsed = JSON.parse(row.value);
      return { ...DEFAULT_CONFIG, ...parsed };
    } catch (e) {
      this.logger.error(
        `Failed to parse white-label config: ${(e as Error).message}`,
        (e as Error).stack,
      );
      return { ...DEFAULT_CONFIG };
    }
  }

  /**
   * Admin-facing config — same as getRawConfig but with canonical attachment
   * paths re-signed so the admin UI can render previews and PUT the same
   * value back without re-uploading.
   */
  async getConfig(): Promise<WhiteLabelConfig> {
    const cfg = await this.getRawConfig();
    // Sign the 4 asset URLs in parallel — each may hit the storage adapter.
    const [logoUrl, logoDarkUrl, faviconUrl, formBannerUrl] = await Promise.all(
      [
        this.resolveAssetUrl(cfg.logoUrl),
        this.resolveAssetUrl(cfg.logoDarkUrl),
        this.resolveAssetUrl(cfg.faviconUrl),
        this.resolveAssetUrl(cfg.formBannerUrl),
      ],
    );
    return { ...cfg, logoUrl, logoDarkUrl, faviconUrl, formBannerUrl };
  }

  /**
   * True only when the current plan actually entitles white-label. On-prem,
   * white-label is Enterprise-only; `getOnPremPlan()` returns null on
   * cloud / local-EE (where the instance config is empty anyway), so we only
   * deny when there's a real on-prem plan that lacks the feature.
   */
  private planAllowsWhiteLabel(): boolean {
    const plan = getOnPremPlan();
    if (!plan) return true;
    return plan.meta?.[PlanFeatureTypes.FEATURE_WHITE_LABEL] === true;
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
    // Enforce the plan entitlement on the READ path too. The controller's
    // @License only guards writes; without this check, branding set under a
    // valid Enterprise license keeps serving via appInfo + emails after the
    // license expires or the plan downgrades (all lower plans disable the
    // feature). Both the appInfo response and transactional emails resolve
    // through here, so a single gate covers both.
    if (!this.planAllowsWhiteLabel()) return null;
    // Logo, dark logo and favicon resolve to the stable, never-expiring asset
    // endpoint — absolute URLs that survive restarts and resolve from email
    // clients (a signed `/dltemp` URL expires and, on local storage without
    // Redis, dies on the next restart). These are pure string builds (no
    // signing / storage hit), so the hot appInfo path stays cheap. The form
    // banner only ever renders in-product on a live page that re-fetches
    // appInfo, so it keeps the cheaper 7-day signed URL.
    const formBannerUrl = await this.resolveAssetUrl(cfg.formBannerUrl);
    return {
      ...cfg,
      logoUrl: this.publicAssetUrl('logo', cfg.logoUrl),
      logoDarkUrl: this.publicAssetUrl('logoDark', cfg.logoDarkUrl),
      faviconUrl: this.publicAssetUrl('favicon', cfg.faviconUrl),
      formBannerUrl,
    };
  }

  /**
   * Raw From display-name override for transactional emails. Plan-gated like
   * the public config, but skips asset signing (callers only need the string).
   * Returns null when disabled / not entitled / unset.
   */
  async getEmailSenderName(): Promise<string | null> {
    const cfg = await this.getRawConfig();
    if (!cfg.enabled || !this.planAllowsWhiteLabel()) return null;
    // Never blank — fall back to the product name, then the NocoDB default, so
    // the email From always shows a friendly sender name (a bare address or an
    // empty name looks broken in inboxes).
    return cfg.email?.senderName?.trim() || cfg.productName?.trim() || 'NocoDB';
  }

  /**
   * Sanitized view for the unauthenticated `appInfo` response. Same as
   * getPublicConfig but strips the email sender name / footer text — anonymous
   * callers only need `footerUrl` (the public-form footer link); the configured
   * sender copy is only used server-side when rendering emails.
   */
  async getAppInfoConfig(): Promise<WhiteLabelConfig | null> {
    const cfg = await this.getPublicConfig();
    if (!cfg) return null;
    return {
      ...cfg,
      email: cfg.email?.footerUrl ? { footerUrl: cfg.email.footerUrl } : null,
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

    const attachment: { path: string; mimetype: string; signedPath?: string } =
      {
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
        `Failed to sign white-label asset ${canonical}: ${
          (e as Error).message
        }`,
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

  // ---- Stable public asset endpoint -----------------------------------------

  /**
   * Absolute origin for building asset-endpoint URLs. These URLs are embedded
   * in transactional emails (and, later, og tags), so they must be absolute —
   * an inbox can't resolve a same-origin path. `getPublicConfig` has no request
   * in scope (it's also called from the mail service), so derive from the
   * configured site URL with a localhost fallback for dev.
   */
  private baseUrl(): string {
    return (
      ncSiteUrl || `http://localhost:${process.env.PORT || 8080}`
    ).replace(/\/+$/, '');
  }

  /** Cache-busting token so a re-uploaded asset (new nanoid) yields a new URL. */
  private assetVersion(canonical: string): string {
    return createHash('sha1').update(canonical).digest('hex').slice(0, 8);
  }

  /**
   * Public-facing URL for a brand asset. Our own uploads (canonical
   * `download/whiteLabel/...`) route through the stable, never-expiring asset
   * endpoint so they survive restarts and load from email clients; same-origin
   * paths are absolutized against the base URL (so email clients can resolve
   * them) and external/CDN URLs pass through unchanged.
   */
  private publicAssetUrl(
    type: PublicAssetType,
    value: string | null | undefined,
  ): string | null {
    if (!value) return null;
    if (/^download\//i.test(value)) {
      return `${this.baseUrl()}/api/v2/meta/white-label/asset/${type}?v=${this.assetVersion(
        value,
      )}`;
    }
    // Manually-pasted same-origin path — absolutize so email clients can resolve it.
    if (value.startsWith('/')) return `${this.baseUrl()}${value}`;
    return value;
  }

  /** NocoDB default served when white-label is off / the asset isn't set. */
  private defaultAssetUrl(type: string): string {
    if (type === 'favicon') return `${this.baseUrl()}/favicon.ico`;
    return `${NC_EMAIL_ASSETS_BASE_URL}/nocodb-logo.png`;
  }

  /**
   * Backing resolver for `GET /api/v2/meta/white-label/asset/:type`. Returns
   * either a `redirectUrl` (external/CDN value, a freshly-signed cloud URL, or
   * the NocoDB default) or a local `filePath` + `contentType` for the controller
   * to stream. Never expires from the caller's perspective: cloud URLs are
   * re-minted per request; local files are read straight off disk (no cache),
   * so the URL keeps working across restarts.
   */
  async getAssetServeInfo(type: string): Promise<{
    redirectUrl?: string;
    filePath?: string;
    contentType?: string;
  }> {
    const field = PUBLIC_ASSET_FIELDS[type as PublicAssetType];
    if (!field) return { redirectUrl: this.defaultAssetUrl(type) };

    const cfg = await this.getRawConfig();
    if (!cfg.enabled || !this.planAllowsWhiteLabel()) {
      return { redirectUrl: this.defaultAssetUrl(type) };
    }

    // Light ↔ dark cross-fallback: a single uploaded logo should serve in both
    // modes (mirrors the frontend `useBranding`). favicon has no counterpart.
    let value = cfg[field];
    if (!value) {
      if (type === 'logo') value = cfg.logoDarkUrl;
      else if (type === 'logoDark') value = cfg.logoUrl;
    }
    if (!value) return { redirectUrl: this.defaultAssetUrl(type) };

    // External CDN URL — redirect as-is.
    if (/^https?:\/\//i.test(value)) return { redirectUrl: value };
    // Manually-pasted same-origin path — absolutize.
    if (value.startsWith('/')) {
      return { redirectUrl: `${this.baseUrl()}${value}` };
    }
    // Anything that isn't our own canonical upload → fall back to the default.
    if (!/^download\/whiteLabel\//i.test(value) || value.includes('..')) {
      return { redirectUrl: this.defaultAssetUrl(type) };
    }

    const relPath = value.replace(/^download[/\\]/i, '');
    // Resolve a SAFE image content-type from the extension allowlist — never
    // from the value's real type. A value whose extension isn't an allowed
    // image (e.g. a legacy `.html` row saved before this guard) falls back to
    // the default asset instead of being served as text/html.
    const contentType = ASSET_CONTENT_TYPE[assetExt(value)];
    if (!contentType) return { redirectUrl: this.defaultAssetUrl(type) };
    const storageAdapter = await NcPluginMgrv2.storageAdapter();

    // Cloud (S3/GCS): mint a fresh signed URL and redirect to it. The 7-day cap
    // is irrelevant because the redirect consumes it immediately, while the
    // endpoint URL itself never changes.
    if (typeof (storageAdapter as any).getSignedUrl === 'function') {
      const signed = await PresignedUrl.getSignedUrl({
        pathOrUrl: relPath,
        preview: true,
        mimetype: contentType,
        expireSeconds: ASSET_URL_EXPIRE_SECONDS,
      });
      return { redirectUrl: signed };
    }

    // Local storage: stream the file straight off disk — permanent, no cache
    // dependency, survives restarts. `validateAndNormaliseLocalPath` rejects
    // any path escaping the `nc/` root (defence-in-depth over the prefix check).
    return {
      filePath: validateAndNormaliseLocalPath(path.join('nc', relPath), true),
      contentType,
    };
  }

  async updateConfig(
    body: Partial<WhiteLabelConfig>,
    req: NcRequest,
  ): Promise<WhiteLabelConfig> {
    const prev = await this.getRawConfig();
    const next: WhiteLabelConfig = {
      ...prev,
      ...body,
    };

    // Convert preview URLs back to canonical paths before persistence so the
    // saved value doesn't expire. `/dltemp/...` signed URLs that have rolled
    // out of the cache fall through to validation, which will reject them
    // with a clear "re-upload" message.
    next.logoUrl = await this.canonicalizeAssetUrl(next.logoUrl);
    next.logoDarkUrl = await this.canonicalizeAssetUrl(next.logoDarkUrl);
    next.faviconUrl = await this.canonicalizeAssetUrl(next.faviconUrl);
    next.formBannerUrl = await this.canonicalizeAssetUrl(next.formBannerUrl);

    this.validate(next);

    // saveOrUpdate busts the NocoCache key, so subsequent reads (here and on
    // other nodes) pick up the new value.
    await Store.saveOrUpdate({
      key: NC_STORE_KEY_WHITE_LABEL,
      value: JSON.stringify(next),
      type: 'object',
    });

    // Best-effort: delete asset files that were replaced or cleared, so old
    // uploads don't accumulate in storage. Never blocks the save.
    await this.cleanupReplacedAssets(prev, next);

    // Audit this instance-wide, super-admin-only change.
    this.appHooksService.emit(AppEvents.WHITE_LABEL_UPDATE, {
      orgId: Noco.ncDefaultOrgId,
      enabled: next.enabled,
      req,
    });

    // Return the admin-facing form so the UI can keep rendering previews
    // (canonical paths get re-signed here too).
    return this.getConfig();
  }

  /** Delete the storage files for asset fields that changed value. */
  private async cleanupReplacedAssets(
    prev: WhiteLabelConfig,
    next: WhiteLabelConfig,
  ): Promise<void> {
    for (const key of [
      'logoUrl',
      'logoDarkUrl',
      'faviconUrl',
      'formBannerUrl',
    ] as const) {
      const oldVal = prev[key];
      if (oldVal && oldVal !== next[key]) {
        await this.deleteAssetFile(oldVal);
      }
    }
  }

  /**
   * Best-effort deletion of a previously-uploaded white-label asset file.
   * Strictly scoped: only our own canonical `download/whiteLabel/...` paths are
   * touched — external/CDN URLs, same-origin paths, and anything attempting
   * traversal or a different scope are ignored. Each upload lives under a unique
   * nanoid, so removing the old value never affects the replacement. Never
   * throws — a failed cleanup must not fail the config save.
   */
  private async deleteAssetFile(value: string): Promise<void> {
    const canonical = value.split('?')[0];
    if (
      !/^download\/whiteLabel\//i.test(canonical) ||
      canonical.includes('..')
    ) {
      return;
    }
    try {
      const storageAdapter = await NcPluginMgrv2.storageAdapter();
      // Stored `download/whiteLabel/<hash>/<nanoid>/<file>` maps to the storage
      // key `nc/whiteLabel/<hash>/<nanoid>/<file>` (same key for every adapter).
      const key = path.join('nc', canonical.replace(/^download[/\\]/i, ''));
      await storageAdapter.fileDelete(key);
    } catch (e) {
      this.logger.error(
        `Failed to delete old white-label asset ${canonical}: ${
          (e as Error).message
        }`,
      );
    }
  }

  /** Reverse of resolveAssetUrl — only touches `/dltemp/...` signed URLs. */
  private async canonicalizeAssetUrl(value: string | null | undefined) {
    // Normalize empty/blank → null so a cleared field doesn't trip URL_RE in
    // validate() (the front-end already trims, but direct API callers may send '').
    if (!value || (typeof value === 'string' && value.trim() === ''))
      return null;
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

    for (const key of [
      'logoUrl',
      'logoDarkUrl',
      'faviconUrl',
      'formBannerUrl',
    ] as const) {
      const v = cfg[key];
      if (v != null) {
        if (typeof v !== 'string' || !URL_RE.test(v)) {
          NcError.badRequest(
            `\`${key}\` must be an http(s) URL or a same-origin path starting with /`,
          );
        }
        // Require an image extension for any value that has one. Extension-less
        // external URLs (some CDNs) are allowed here and re-gated at serve time
        // by the same allowlist + fixed content-type + nosniff.
        const ext = assetExt(v);
        if (ext && !ALLOWED_ASSET_EXT_RE.test(`.${ext}`)) {
          NcError.badRequest(
            `\`${key}\` must be an image (PNG, JPG, ICO, GIF, WEBP, AVIF, BMP)`,
          );
        }
      }
    }

    if (cfg.brandColor != null) {
      if (
        typeof cfg.brandColor !== 'string' ||
        !HEX_COLOR_RE.test(cfg.brandColor)
      ) {
        NcError.badRequest('`brandColor` must be a hex color like #0D5A5A');
      }
    }

    if (cfg.supportEmail != null) {
      if (
        typeof cfg.supportEmail !== 'string' ||
        cfg.supportEmail.length > MAX_SUPPORT_EMAIL_LEN ||
        !EMAIL_RE.test(cfg.supportEmail)
      ) {
        NcError.badRequest('`supportEmail` must be a valid email address');
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
