import { nanoid } from 'nanoid';
import contentDisposition from 'content-disposition';
import slash from 'slash';
import { IconType, ncIsObject } from 'nocodb-sdk';
import type { MetaType } from 'nocodb-sdk';
import NcPluginMgrv2 from '~/helpers/NcPluginMgrv2';
import Noco from '~/Noco';
import NocoCache from '~/cache/NocoCache';
import { CacheGetType, CacheScope } from '~/utils/globals';
import { getPathFromUrl, isPreviewAllowed } from '~/helpers/attachmentHelpers';
import { parseMetaProp } from '~/utils/modelUtils';

function roundExpiry(date) {
  const msInHour = 10 * 60 * 1000;
  return new Date(Math.ceil(date.getTime() / msInHour) * msInHour);
}

const DEFAULT_EXPIRE_SECONDS = isNaN(
  parseInt(process.env.NC_ATTACHMENT_EXPIRE_SECONDS),
)
  ? 2 * 60 * 60
  : parseInt(process.env.NC_ATTACHMENT_EXPIRE_SECONDS);

export default class PresignedUrl {
  path: string;
  url: string;
  expires_at: string;

  constructor(data: Partial<PresignedUrl>) {
    Object.assign(this, data);
  }

  private static async add(param: {
    path: string;
    url: string;
    expires_at: Date;
    expiresInSeconds?: number;
  }) {
    const {
      path,
      url,
      expires_at,
      expiresInSeconds = DEFAULT_EXPIRE_SECONDS,
    } = param;
    await NocoCache.setExpiring(
      `${CacheScope.PRESIGNED_URL}:path:${slash(path)}`,
      {
        path,
        url,
        expires_at,
      },
      expiresInSeconds,
    );
    await NocoCache.setExpiring(
      `${CacheScope.PRESIGNED_URL}:url:${slash(decodeURIComponent(url))}`,
      {
        path,
        url,
        expires_at,
      },
      expiresInSeconds,
    );
  }

  private static async delete(param: { path: string; url: string }) {
    const { path, url } = param;
    await NocoCache.del(`${CacheScope.PRESIGNED_URL}:path:${slash(path)}`);
    await NocoCache.del(`${CacheScope.PRESIGNED_URL}:url:${slash(url)}`);
  }

  public static async getPath(url: string, _ncMeta = Noco.ncMeta) {
    const urlData =
      url &&
      (await NocoCache.get(
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
    param: {
      pathOrUrl: string;
      expireSeconds?: number;
      filename?: string;
      preview?: boolean;
      mimetype?: string;
      encoding?: string;
    },
    ncMeta = Noco.ncMeta,
  ) {
    const isUrl = /^https?:\/\//i.test(param.pathOrUrl);

    let path = (
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

    const expireAt = roundExpiry(
      new Date(new Date().getTime() + expireSeconds * 1000),
    ); // at least expireSeconds from now

    // calculate the expiry time in seconds considering rounding
    const expiresInSeconds = Math.ceil(
      (expireAt.getTime() - new Date().getTime()) / 1000,
    );

    let tempUrl;

    const pathParameters: {
      [key: string]: string;
    } = {};

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

    const url = await NocoCache.get(
      `${CacheScope.PRESIGNED_URL}:path:${slash(cachePath)}`,
      CacheGetType.TYPE_OBJECT,
    );

    if (url) {
      // if present, check if the expiry date is greater than now
      if (new Date(url.expires_at).getTime() > new Date().getTime()) {
        // if greater, return the url
        return url.url;
      } else {
        // if not, delete the url
        await this.delete({ path: url.path, url: url.url });
      }
    }

    const storageAdapter = await NcPluginMgrv2.storageAdapter(ncMeta);

    if (typeof (storageAdapter as any).getSignedUrl === 'function') {
      tempUrl = await (storageAdapter as any).getSignedUrl(
        path,
        expiresInSeconds,
        pathParameters,
      );
      await this.add({
        path: cachePath,
        url: tempUrl,
        expires_at: expireAt,
        expiresInSeconds,
      });
    } else {
      // if not present, use url or generate url for local storage
      tempUrl = isUrl
        ? param.pathOrUrl
        : `dltemp/${nanoid(16)}/${expireAt.getTime()}/${path}`;

      path = `${path}?${new URLSearchParams(pathParameters).toString()}`;

      await this.add({
        path: path,
        url: tempUrl,
        expires_at: expireAt,
        expiresInSeconds,
      });
    }

    // return the url
    return tempUrl;
  }

  public static async signAttachment(
    param: {
      attachment: {
        url?: string;
        path?: string;
        mimetype: string;
        signedPath?: string;
        signedUrl?: string;
      };
      preview?: boolean;
      mimetype?: string;
      filename?: string;
      expireSeconds?: number;
      // allow writing to nested property instead of root (used for thumbnails)
      nestedKeys?: string[];
    },
    ncMeta = Noco.ncMeta,
  ) {
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
      nestedObj.signedPath = await PresignedUrl.getSignedUrl(
        {
          pathOrUrl: attachment.path.replace(/^download[/\\]/i, ''),
          preview,
          mimetype: mimetype || attachment.mimetype,
          ...(extra ? { ...extra } : {}),
        },
        ncMeta,
      );
    } else if (attachment?.url) {
      nestedObj.signedUrl = await PresignedUrl.getSignedUrl(
        {
          pathOrUrl: attachment.url,
          preview,
          mimetype: mimetype || attachment.mimetype,
          ...(extra ? { ...extra } : {}),
        },
        ncMeta,
      );
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

    const promises = [];

    try {
      for (const d of Array.isArray(data) ? data : [data]) {
        if (!ncIsObject(d)) {
          continue;
        }

        d.meta = parseMetaProp(d);

        if (
          d.meta &&
          (d.meta as Record<string, any>).icon &&
          (d.meta as Record<string, any>).iconType === IconType.IMAGE
        ) {
          promises.push(
            PresignedUrl.signAttachment({
              attachment: (d.meta as Record<string, any>).icon,
            }),
          );
        }
      }

      await Promise.all(promises);
    } catch {}
  }
}
