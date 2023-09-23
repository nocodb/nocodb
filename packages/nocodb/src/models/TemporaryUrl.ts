import NcPluginMgrv2 from 'src/helpers/NcPluginMgrv2';
import Noco from '~/Noco';
import NocoCache from '~/cache/NocoCache';
import { CacheGetType, CacheScope } from '~/utils/globals';

function roundExpiry(date) {
  const msInHour = 10 * 60 * 1000;
  return new Date(Math.ceil(date.getTime() / msInHour) * msInHour);
}

const DEFAULT_EXPIRE_SECONDS = 2 * 60 * 60;

export default class TemporaryUrl {
  path: string;
  url: string;
  expires_at: string;

  constructor(data: Partial<TemporaryUrl>) {
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
      `${CacheScope.TEMPORARY_URL}:path:${path}`,
      {
        path,
        url,
        expires_at,
      },
      expiresInSeconds,
    );
    await NocoCache.setExpiring(
      `${CacheScope.TEMPORARY_URL}:url:${url}`,
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
    await NocoCache.del(`${CacheScope.TEMPORARY_URL}:path:${path}`);
    await NocoCache.del(`${CacheScope.TEMPORARY_URL}:url:${url}`);
  }

  public static async getPath(url: string, _ncMeta = Noco.ncMeta) {
    const urlData =
      url &&
      (await NocoCache.get(
        `${CacheScope.TEMPORARY_URL}:url:${url}`,
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

  public static async getTemporaryUrl(
    param: {
      path: string;
      expireSeconds?: number;
      s3?: boolean;
    },
    _ncMeta = Noco.ncMeta,
  ) {
    const { path, expireSeconds = DEFAULT_EXPIRE_SECONDS, s3 = false } = param;
    const expireAt = roundExpiry(
      new Date(new Date().getTime() + expireSeconds * 1000),
    ); // at least expireSeconds from now

    let tempUrl;

    const url = await NocoCache.get(
      `${CacheScope.TEMPORARY_URL}:path:${path}`,
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

    if (s3) {
      // if not present, create a new url
      const storageAdapter = await NcPluginMgrv2.storageAdapter();

      const expiresInSeconds = Math.ceil(
        (expireAt.getTime() - new Date().getTime()) / 1000,
      );

      tempUrl = await (storageAdapter as any).getSignedUrl(
        path,
        expiresInSeconds,
      );
      await this.add({
        path: path,
        url: tempUrl,
        expires_at: expireAt,
      });
    } else {
      // if not present, create a new url
      tempUrl = `dltemp/${expireAt.getTime()}/${path}`;
      await this.add({
        path: path,
        url: tempUrl,
        expires_at: expireAt,
      });
    }

    // return the url
    return tempUrl;
  }
}
