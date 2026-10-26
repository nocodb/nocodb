import { nanoid } from 'nanoid';
import contentDisposition from 'content-disposition';
import slash from 'slash';
import { IconType, ncIsObject } from 'nocodb-sdk';
import { Logger } from '@nestjs/common';
import type { MetaType } from 'nocodb-sdk';
import NcPluginMgrv2 from '~/helpers/NcPluginMgrv2';
import Noco from '~/Noco';
import NocoCache from '~/cache/NocoCache';
import { CacheGetType, CacheScope } from '~/utils/globals';
import {
  getPathFromUrl,
  isPreviewAllowed,
  isStorageAttachmentRef,
} from '~/helpers/attachmentHelpers';
import { parseMetaProp } from '~/utils/modelUtils';
import { processConcurrently } from '~/utils/dataUtils';

// Expiry is rounded up to this window, so every request in a window gets the same URL.
const REUSE_WINDOW_SECONDS = 60 * 60;
// S3 SigV4 rejects presigned URLs valid for longer than a week.
const MAX_SIGNED_URL_SECONDS = 7 * 24 * 60 * 60;

function roundExpiry(date) {
  const windowMs = REUSE_WINDOW_SECONDS * 1000;
  return new Date(Math.ceil(date.getTime() / windowMs) * windowMs);
}
const logger = new Logger('Presigned URL');

const DEFAULT_EXPIRE_SECONDS = isNaN(
  parseInt(process.env.NC_ATTACHMENT_EXPIRE_SECONDS),
)
  ? 2 * 60 * 60
  : parseInt(process.env.NC_ATTACHMENT_EXPIRE_SECONDS);

interface SignUrlParams {
  pathOrUrl: string;
  expireSeconds?: number;
  filename?: string;
  preview?: boolean;
  mimetype?: string;
  encoding?: string;
  /**
   * When true the file lives on local disk regardless of the active storage
   * adapter, so the dltemp route is used instead of external signed URLs.
   * Set this when signing an attachment whose DB record has a `path` field
   * (meaning it was stored before any migration to external storage).
   */
  isLocalPath?: boolean;
}

interface SignRequest {
  path: string;
  cachePath: string;
  cacheKey: string;
  pathParameters: { [key: string]: string };
  expireAt: Date;
  expiresInSeconds: number;
  reusableForSeconds: number;
  isLocalPath?: boolean;
  // the own-storage url being signed, when it came in as a url
  url?: string;
}

export interface SignAttachmentParams {
  attachment: {
    url?: string;
    path?: string;
    mimetype: string;
    signedPath?: string;
    signedUrl?: string;
    status?: string;
  };
  preview?: boolean;
  mimetype?: string;
  filename?: string;
  expireSeconds?: number;
  // allow writing to nested property instead of root (used for thumbnails)
  nestedKeys?: string[];
}

export default class PresignedUrl {
  path: string;
  url: string;
  expires_at: string;

  constructor(data: Partial<PresignedUrl>) {
    Object.assign(this, data);
  }

  private static async delete(param: { path: string; url: string }) {
    const { path, url } = param;
    await NocoCache.del(
      'root',
      `${CacheScope.PRESIGNED_URL}:path:${slash(path)}`,
    );
    await NocoCache.del(
      'root',
      `${CacheScope.PRESIGNED_URL}:url:${slash(url)}`,
    );
  }

  public static async getPath(url: string, _ncMeta = Noco.ncMeta) {
    const urlData =
      url &&
      (await NocoCache.get(
        'root',
        `${CacheScope.PRESIGNED_URL}:url:${slash(url)}`,
        CacheGetType.TYPE_OBJECT,
      ));
    if (!urlData) {
      return null;
    }

    // if present, check if the expiry date is greater than now
    if (
      urlData &&
      new Date(urlData.expires_at).getTime() < new Date().getTime()
    ) {
      // if not, delete the url
      await this.delete({ path: urlData.path, url: urlData.url });
      return null;
    }

    return urlData?.path;
  }

  public static async getSignedUrl(
    param: SignUrlParams,
    ncMeta = Noco.ncMeta,
  ): Promise<string> {
    const [result] = await this.getSignedUrls([param], ncMeta);
    if (result.status === 'rejected') throw result.reason;
    return result.value;
  }

  // One cache read and one cache write for the whole batch; a file that fails to sign doesn't fail the rest.
  public static async getSignedUrls(
    params: SignUrlParams[],
    ncMeta = Noco.ncMeta,
  ): Promise<PromiseSettledResult<string>[]> {
    const prepared = await Promise.allSettled(
      params.map((param) => this.prepareSigning(param)),
    );

    // keyed by cache key, so a file the batch holds twice is signed once
    const requests = new Map<string, SignRequest>();
    for (const result of prepared) {
      if (result.status === 'fulfilled' && typeof result.value !== 'string') {
        requests.set(result.value.cacheKey, result.value);
      }
    }

    const cacheKeys = [...requests.keys()];
    // the cache only saves re-signing, so a failed read signs everything
    const cached = await NocoCache.getMany('root', cacheKeys).catch((e) => {
      logger.warn(`Failed to read presigned urls: ${e.message}`);
      return cacheKeys.map(() => null);
    });
    const signed = new Map<string, PromiseSettledResult<string>>();
    const misses: SignRequest[] = [];

    cacheKeys.forEach((cacheKey, i) => {
      if (new Date(cached[i]?.expires_at).getTime() > new Date().getTime()) {
        signed.set(cacheKey, { status: 'fulfilled', value: cached[i].url });
      } else {
        misses.push(requests.get(cacheKey));
      }
    });

    if (misses.length) {
      const storageAdapter = await NcPluginMgrv2.storageAdapter(ncMeta);
      const writes: ReturnType<typeof PresignedUrl.cacheEntries> = [];

      await processConcurrently(misses, async (request) => {
        try {
          const { url, local } = await this.sign(request, storageAdapter);
          writes.push(...this.cacheEntries(request, url, local));
          signed.set(request.cacheKey, { status: 'fulfilled', value: url });
        } catch (reason) {
          signed.set(request.cacheKey, { status: 'rejected', reason });
        }
      });

      const errors = await NocoCache.setExpiringMany(
        'root',
        writes.map((write) => write.entry),
      ).catch((e): (Error | null)[] => writes.map(() => e));
      const failed = errors.filter(Boolean);
      if (failed.length) {
        logger.warn(
          `Failed to cache ${failed.length} presigned url entries: ${failed[0].message}`,
        );
      }
      writes.forEach((write, i) => {
        if (errors[i] && write.required) {
          signed.set(write.owner, { status: 'rejected', reason: errors[i] });
        }
      });
    }

    return prepared.map((result): PromiseSettledResult<string> => {
      if (result.status === 'rejected') return result;
      if (typeof result.value === 'string') {
        return { status: 'fulfilled', value: result.value };
      }
      return signed.get(result.value.cacheKey);
    });
  }

  // an external link comes back as is, since there is nothing to sign
  private static async prepareSigning(
    param: SignUrlParams,
  ): Promise<SignRequest | string> {
    const isUrl = /^https?:\/\//i.test(param.pathOrUrl);

    // An external link is never reduced to a storage key. Checked before the
    // cache, which is keyed by pathname and could hold our object's signature.
    // Uses the process-cached own-host list, so no plugin-row read per sign.
    if (isUrl && !(await isStorageAttachmentRef(param.pathOrUrl))) {
      return param.pathOrUrl;
    }

    const path = (
      isUrl ? getPathFromUrl(param.pathOrUrl) : param.pathOrUrl
    ).replace(/^\/+/, '');

    const {
      expireSeconds = DEFAULT_EXPIRE_SECONDS,
      filename,
      mimetype,
      encoding,
    } = param;

    const preview = param.preview
      ? isPreviewAllowed({ path, mimetype })
      : false;

    // leaves room to round up to the window without passing the presign limit
    const validForSeconds = Math.min(
      expireSeconds,
      MAX_SIGNED_URL_SECONDS - REUSE_WINDOW_SECONDS,
    );

    const expireAt = roundExpiry(
      new Date(new Date().getTime() + validForSeconds * 1000),
    ); // at least validForSeconds from now

    // calculate the expiry time in seconds considering rounding
    const expiresInSeconds = Math.ceil(
      (expireAt.getTime() - new Date().getTime()) / 1000,
    );

    // expireAt is part of the cache key, so the entry is only hit until now + validForSeconds passes it
    const reusableForSeconds = Math.max(1, expiresInSeconds - validForSeconds);

    const pathParameters: {
      [key: string]: string;
    } = {
      expireAt: expireAt.toISOString(),
    };

    if (preview) {
      pathParameters.ResponseContentDisposition = `inline;`;

      if (filename) {
        pathParameters.ResponseContentDisposition = contentDisposition(
          filename,
          { type: 'inline' },
        );
      }
    } else {
      pathParameters.ResponseContentDisposition = `attachment;`;

      if (filename) {
        pathParameters.ResponseContentDisposition = contentDisposition(
          filename,
          { type: 'attachment' },
        );
      }
    }

    if (mimetype) {
      pathParameters.ResponseContentType = mimetype;

      if (encoding) {
        pathParameters.ResponseContentType = `${mimetype}; charset=${encoding}`;
      }
    }

    if (encoding) {
      pathParameters.ResponseContentEncoding = encoding;
    }

    // append query params to the cache path
    const cachePath = `${path}?${new URLSearchParams(
      pathParameters,
    ).toString()}`;

    return {
      path,
      cachePath,
      cacheKey: `${CacheScope.PRESIGNED_URL}:path:${slash(cachePath)}`,
      pathParameters,
      expireAt,
      expiresInSeconds,
      reusableForSeconds,
      isLocalPath: param.isLocalPath,
      url: isUrl ? param.pathOrUrl : undefined,
    };
  }

  private static async sign(
    request: SignRequest,
    storageAdapter,
  ): Promise<{ url: string; local: boolean }> {
    if (
      !request.isLocalPath &&
      typeof (storageAdapter as any).getSignedUrl === 'function'
    ) {
      const url = await (storageAdapter as any).getSignedUrl(
        request.path,
        request.expiresInSeconds,
        request.pathParameters,
      );
      return { url, local: false };
    }

    // use url or generate url for local storage
    return {
      url:
        request.url ??
        `dltemp/${nanoid(16)}/${request.expireAt.getTime()}/${request.path}`,
      local: true,
    };
  }

  private static cacheEntries(
    request: SignRequest,
    url: string,
    local: boolean,
  ) {
    const value = {
      path: request.cachePath,
      url,
      expires_at: request.expireAt,
    };
    // only saves re-signing, so the url is handed out even when this write fails
    const writes = [
      {
        owner: request.cacheKey,
        entry: {
          key: request.cacheKey,
          value,
          seconds: request.reusableForSeconds,
        },
        required: false,
      },
    ];

    // a local url is resolved back to its path (dltemp), which authorizes the download, so it lives as long as the url
    if (local) {
      writes.push({
        owner: request.cacheKey,
        entry: {
          key: `${CacheScope.PRESIGNED_URL}:url:${slash(
            decodeURIComponent(url),
          )}`,
          value,
          seconds: request.expiresInSeconds,
        },
        required: true,
      });
    }

    return writes;
  }

  public static async signAttachment(
    param: SignAttachmentParams,
    ncMeta = Noco.ncMeta,
  ) {
    const signing = this.attachmentSigning(param);
    if (!signing) return;
    signing.target[signing.field] = await PresignedUrl.getSignedUrl(
      signing.params,
      ncMeta,
    );
  }

  // signs in one batch; a file that fails to sign is left unsigned
  public static async signAttachments(
    params: SignAttachmentParams[],
    ncMeta = Noco.ncMeta,
  ) {
    const signings = params
      .map((param) => this.attachmentSigning(param))
      .filter(Boolean);
    const results = await this.getSignedUrls(
      signings.map((signing) => signing.params),
      ncMeta,
    );
    results.forEach((result, i) => {
      if (result.status === 'fulfilled') {
        signings[i].target[signings[i].field] = result.value;
      }
    });
  }

  private static attachmentSigning(param: SignAttachmentParams) {
    const {
      nestedKeys = [],
      attachment,
      preview = true,
      mimetype,
      ...extra
    } = param;

    const nestedObj = nestedKeys.reduce((acc, key) => {
      if (acc[key]) {
        return acc[key];
      }

      acc[key] = {};
      return acc[key];
    }, attachment);

    if (attachment?.path) {
      return {
        target: nestedObj,
        field: 'signedPath',
        params: {
          pathOrUrl: attachment.path.replace(/^download[/\\]/i, ''),
          preview,
          mimetype: mimetype || attachment.mimetype,
          // attachment.path means the file was stored on local disk; skip the
          // S3 adapter even if one is configured now (e.g. after migrating from
          // local storage) — the file was never uploaded to S3.
          isLocalPath: true,
          ...(extra ? { ...extra } : {}),
        },
      };
    } else if (
      attachment?.url &&
      attachment.status !== 'uploading' &&
      attachment.status !== 'failed'
    ) {
      return {
        target: nestedObj,
        field: 'signedUrl',
        params: {
          pathOrUrl: attachment.url,
          preview,
          mimetype: mimetype || attachment.mimetype,
          ...(extra ? { ...extra } : {}),
        },
      };
    }
  }

  public static async signMetaIconImage(
    data:
      | Partial<{
          meta?: MetaType;
          [key: string]: any;
        }>
      | Partial<{
          meta?: MetaType;
          [key: string]: any;
        }>[],
  ) {
    if (!data) return;

    const allItems = [];

    try {
      for (const d of Array.isArray(data) ? data : [data]) {
        if (!ncIsObject(d) || !d.meta) {
          continue;
        }

        d.meta = parseMetaProp(d);

        if (
          d.meta &&
          (d.meta as Record<string, any>).icon &&
          (d.meta as Record<string, any>).iconType === IconType.IMAGE
        ) {
          allItems.push({
            attachment: (d.meta as Record<string, any>).icon,
          });
        }
      }

      await processConcurrently(
        allItems,
        async (item) => {
          try {
            await PresignedUrl.signAttachment(item);
          } catch (e) {}
        },
        15,
      );
    } catch (e) {
      logger.error('Error signing meta icon image', e);
    }
  }
}
