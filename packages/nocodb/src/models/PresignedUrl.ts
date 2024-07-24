import { nanoid } from 'nanoid';
import NcPluginMgrv2 from '~/helpers/NcPluginMgrv2';
import Noco from '~/Noco';
import NocoCache from '~/cache/NocoCache';
import { CacheGetType, CacheScope } from '~/utils/globals';
import { isPreviewAllowed } from '~/helpers/attachmentHelpers';

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
      `${CacheScope.PRESIGNED_URL}:path:${path}`,
      {
        path,
        url,
        expires_at,
      },
      expiresInSeconds,
    );
    await NocoCache.setExpiring(
      `${CacheScope.PRESIGNED_URL}:url:${decodeURIComponent(url)}`,
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
    await NocoCache.del(`${CacheScope.PRESIGNED_URL}:path:${path}`);
    await NocoCache.del(`${CacheScope.PRESIGNED_URL}:url:${url}`);
  }

  public static async getPath(url: string, _ncMeta = Noco.ncMeta) {
    const urlData =
      url &&
      (await NocoCache.get(
        `${CacheScope.PRESIGNED_URL}:url:${url}`,
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
      path: string;
      expireSeconds?: number;
      filename?: string;
      preview?: boolean;
      mimetype?: string;
    },
    ncMeta = Noco.ncMeta,
  ) {
    let path = param.path.replace(/^\/+/, '');

    const {
      expireSeconds = DEFAULT_EXPIRE_SECONDS,
      filename,
      mimetype,
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
        pathParameters.ResponseContentDisposition += ` filename="${filename}"`;
      }
    } else {
      pathParameters.ResponseContentDisposition = `attachment;`;

      if (filename) {
        pathParameters.ResponseContentDisposition += ` filename="${filename}"`;
      }
    }

    if (mimetype) {
      pathParameters.ResponseContentType = mimetype;
    }

    // append query params to the cache path
    const cachePath = `${path}?${new URLSearchParams(
      pathParameters,
    ).toString()}`;

    const url = await NocoCache.get(
      `${CacheScope.PRESIGNED_URL}:path:${cachePath}`,
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
      // if not present, create a new url
      tempUrl = `dltemp/${nanoid(16)}/${expireAt.getTime()}/${path}`;

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
}
