import Noco from '~/Noco';
import NocoCache from '~/cache/NocoCache';
import { CacheGetType, CacheScope, MetaTable } from '~/utils/globals';

function roundExpiry(date) {
  const msInHour = 10 * 60 * 1000;
  return new Date(Math.ceil(date.getTime() / msInHour) * msInHour);
}

export default class TemporaryUrl {
  key: string;
  url: string;
  expires_at: string;

  constructor(data: Partial<TemporaryUrl>) {
    Object.assign(this, data);
  }

  public static async getPath(url: string, ncMeta = Noco.ncMeta) {
    let urlData =
      url &&
      (await NocoCache.get(
        `${CacheScope.TEMPORARY_URL}:${url}`,
        CacheGetType.TYPE_OBJECT,
      ));
    if (!urlData) {
      urlData = await ncMeta.metaGet2(null, null, MetaTable.TEMPORARY_URLS, {
        url,
      });
      await NocoCache.set(`${CacheScope.TEMPORARY_URL}:${url}`, urlData);
    }

    // if present, check if the expiry date is greater than now
    if (
      urlData &&
      new Date(urlData.expires_at).getTime() < new Date().getTime()
    ) {
      // if not, delete the url
      await ncMeta.metaDelete(null, null, MetaTable.TEMPORARY_URLS, {
        url,
      });
      await NocoCache.del(`${CacheScope.TEMPORARY_URL}:${url}`);
      return null;
    }

    return urlData?.key;
  }

  public static async getTemporaryUrl(
    param: {
      path: string;
      expireSeconds?: number;
    },
    ncMeta = Noco.ncMeta,
  ) {
    const { path, expireSeconds = 2 * 60 * 60 } = param;
    const expireAt = roundExpiry(
      new Date(new Date().getTime() + expireSeconds * 1000),
    ); // at least expireSeconds from now

    // check if the url is already present in the db
    const url = await ncMeta.metaGet2(null, null, MetaTable.TEMPORARY_URLS, {
      key: path,
    });

    if (url) {
      // if present, check if the expiry date is greater than now
      if (new Date(url.expires_at).getTime() > new Date().getTime()) {
        // if greater, return the url
        return url.url;
      } else {
        // if not, delete the url
        await ncMeta.metaDelete(null, null, MetaTable.TEMPORARY_URLS, {
          key: path,
        });
      }
    }

    // if not present, create a new url
    const tempUrl = `dltemp/${expireAt.getTime()}/${path}`;
    await ncMeta.metaInsert2(
      null,
      null,
      MetaTable.TEMPORARY_URLS,
      {
        key: path,
        url: tempUrl,
        expires_at: expireAt,
      },
      true,
    );

    // return the url
    return tempUrl;
  }
}
