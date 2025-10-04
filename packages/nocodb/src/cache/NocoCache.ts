import RedisCacheMgr from './RedisCacheMgr';
import RedisMockCacheMgr from './RedisMockCacheMgr';
import type { NcContext } from 'nocodb-sdk';
import type CacheMgr from './CacheMgr';
import { CACHE_PREFIX, CacheGetType } from '~/utils/globals';
import { getRedisURL } from '~/helpers/redisHelpers';

type CacheContext = NcContext | 'root';

function cacheContext(context: CacheContext) {
  if (context === 'root') {
    return `root`;
  }
  return `${context.workspace_id || 'nc'}:${context.base_id || 'nc'}`;
}

export default class NocoCache {
  private static client: CacheMgr;
  private static cacheDisabled: boolean;
  private static prefix: string;

  public static init() {
    this.cacheDisabled = (process.env.NC_DISABLE_CACHE || false) === 'true';
    if (this.cacheDisabled) {
      return;
    }
    if (getRedisURL()) {
      this.client = new RedisCacheMgr(getRedisURL());
    } else {
      this.client = new RedisMockCacheMgr();
    }

    // TODO(cache): fetch orgs once it's implemented
    const orgs = 'noco';
    this.prefix = `${CACHE_PREFIX}:${orgs}`;
  }

  public static disableCache() {
    this.cacheDisabled = true;
  }

  public static enableCache() {
    // return to default value
    this.cacheDisabled = (process.env.NC_DISABLE_CACHE || false) === 'true';
  }

  public static async set(context: CacheContext, key, value): Promise<boolean> {
    if (this.cacheDisabled) return Promise.resolve(true);
    return this.client.set(
      `${this.prefix}:${cacheContext(context)}:${key}`,
      value,
    );
  }

  public static async setExpiring(
    context: CacheContext,
    key,
    value,
    expireSeconds,
  ): Promise<boolean> {
    if (this.cacheDisabled) return Promise.resolve(true);
    return this.client.setExpiring(
      `${this.prefix}:${cacheContext(context)}:${key}`,
      value,
      expireSeconds,
    );
  }

  public static async incrby(
    context: CacheContext,
    key,
    value,
  ): Promise<boolean> {
    if (this.cacheDisabled) return Promise.resolve(true);
    return this.client.incrby(
      `${this.prefix}:${cacheContext(context)}:${key}`,
      value,
    );
  }

  public static async get(context: CacheContext, key, type): Promise<any> {
    if (this.cacheDisabled) {
      if (type === CacheGetType.TYPE_ARRAY) return Promise.resolve([]);
      else if (type === CacheGetType.TYPE_OBJECT) return Promise.resolve(null);
      return Promise.resolve(null);
    }
    return this.client.get(
      `${this.prefix}:${cacheContext(context)}:${key}`,
      type,
    );
  }

  public static async del(context: CacheContext, key): Promise<boolean> {
    if (this.cacheDisabled) return Promise.resolve(true);
    if (Array.isArray(key))
      return this.client.del(
        key.map((k) => `${this.prefix}:${cacheContext(context)}:${k}`),
      );
    return this.client.del(`${this.prefix}:${cacheContext(context)}:${key}`);
  }

  public static async getList(
    context: CacheContext,
    scope: string,
    subKeys: string[],
    orderBy?: {
      key: string;
      dir?: 'asc' | 'desc';
      isString?: boolean;
    },
  ): Promise<{
    list: any[];
    isNoneList: boolean;
  }> {
    if (this.cacheDisabled)
      return Promise.resolve({
        list: [],
        isNoneList: false,
      });
    return this.client.getList(
      `${this.prefix}:${cacheContext(context)}:${scope}`,
      subKeys,
      orderBy,
    );
  }

  public static async setList(
    context: CacheContext,
    scope: string,
    subListKeys: string[],
    list: any[],
    props: string[] = [],
  ): Promise<boolean> {
    if (this.cacheDisabled) return Promise.resolve(true);
    return this.client.setList(
      `${this.prefix}:${cacheContext(context)}:${scope}`,
      subListKeys,
      list,
      props,
    );
  }

  public static async deepDel(
    context: CacheContext,
    key: string,
    direction: string,
  ): Promise<boolean> {
    if (this.cacheDisabled) return Promise.resolve(true);
    return this.client.deepDel(
      `${this.prefix}:${cacheContext(context)}:${key}`,
      direction,
    );
  }

  public static async appendToList(
    context: CacheContext,
    scope: string,
    subListKeys: string[],

    key: string,
  ): Promise<boolean> {
    if (this.cacheDisabled) return Promise.resolve(true);
    return this.client.appendToList(
      `${this.prefix}:${cacheContext(context)}:${scope}`,
      subListKeys,
      `${this.prefix}:${cacheContext(context)}:${key}`,
    );
  }

  public static async update(
    context: CacheContext,
    key: string,
    updateObj: Record<string, any>,
  ): Promise<boolean> {
    if (this.cacheDisabled) return Promise.resolve(true);
    return this.client.update(
      `${this.prefix}:${cacheContext(context)}:${key}`,
      updateObj,
    );
  }

  public static async setHash(
    context: CacheContext,
    key: string,
    hash: Record<string, any>,
    options: {
      ttl?: number;
    } = {},
  ): Promise<boolean> {
    if (this.cacheDisabled) return Promise.resolve(true);
    if (Object.keys(hash).length === 0) {
      return;
    }
    return !!this.client.setHash(
      `${this.prefix}:${cacheContext(context)}:${key}`,
      hash,
      options,
    );
  }

  public static async getHash(
    context: CacheContext,
    key: string,
  ): Promise<Record<string, string | number>> {
    if (this.cacheDisabled) return Promise.resolve({});
    return this.client.getHash(
      `${this.prefix}:${cacheContext(context)}:${key}`,
    );
  }

  public static async getHashField(
    context: CacheContext,
    key: string,
    field: string,
  ): Promise<string> {
    if (this.cacheDisabled) return Promise.resolve(null);
    return this.client.getHashField(
      `${this.prefix}:${cacheContext(context)}:${key}`,
      field,
    );
  }

  public static async setHashField(
    context: CacheContext,
    key: string,
    field: string,
    value: string | number,
  ): Promise<boolean> {
    if (this.cacheDisabled) return Promise.resolve(true);
    return !!this.client.setHashField(
      `${this.prefix}:${cacheContext(context)}:${key}`,
      field,
      value,
    );
  }

  public static async incrHashField(
    context: CacheContext,
    key: string,
    field: string,
    value: number,
  ): Promise<number> {
    if (this.cacheDisabled) return Promise.resolve(0);
    return this.client.incrHashField(
      `${this.prefix}:${cacheContext(context)}:${key}`,
      field,
      value,
    );
  }

  public static async keyExists(
    context: CacheContext,
    key: string,
  ): Promise<boolean> {
    if (this.cacheDisabled) return Promise.resolve(false);
    return this.client.keyExists(
      `${this.prefix}:${cacheContext(context)}:${key}`,
    );
  }

  public static async processPattern(
    context: CacheContext,
    pattern: string,
    callback: (key: string) => Promise<void>,
    options: { count?: number; type?: string } = {},
  ): Promise<void> {
    if (this.cacheDisabled) return Promise.resolve();
    return this.client.processPattern(
      `${this.prefix}:${cacheContext(context)}:${pattern}`,
      callback,
      options,
    );
  }

  public static async destroy(): Promise<boolean> {
    if (this.cacheDisabled) return Promise.resolve(true);
    return this.client.destroy();
  }

  public static async export(): Promise<any> {
    if (this.cacheDisabled) return Promise.resolve({});
    return this.client.export();
  }
}
