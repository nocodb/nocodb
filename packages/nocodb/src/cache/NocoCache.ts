import RedisCacheMgr from './RedisCacheMgr';
import RedisMockCacheMgr from './RedisMockCacheMgr';
import type CacheMgr from './CacheMgr';
import { CacheGetType } from '~/utils/globals';

export default class NocoCache {
  private static client: CacheMgr;
  private static cacheDisabled: boolean;
  private static prefix: string;

  public static init() {
    this.cacheDisabled = (process.env.NC_DISABLE_CACHE || false) === 'true';
    if (this.cacheDisabled) {
      return;
    }
    if (process.env.NC_REDIS_URL) {
      this.client = new RedisCacheMgr(process.env.NC_REDIS_URL);
    } else {
      this.client = new RedisMockCacheMgr();
    }

    // TODO(cache): fetch orgs once it's implemented
    const orgs = 'noco';
    this.prefix = `nc:${orgs}`;
  }

  public static async set(key, value): Promise<boolean> {
    if (this.cacheDisabled) return Promise.resolve(true);
    return this.client.set(`${this.prefix}:${key}`, value);
  }

  public static async setExpiring(key, value, expireSeconds): Promise<boolean> {
    if (this.cacheDisabled) return Promise.resolve(true);
    return this.client.setExpiring(
      `${this.prefix}:${key}`,
      value,
      expireSeconds,
    );
  }

  public static async incrby(key, value): Promise<boolean> {
    if (this.cacheDisabled) return Promise.resolve(true);
    return this.client.incrby(`${this.prefix}:${key}`, value);
  }

  public static async get(key, type): Promise<any> {
    if (this.cacheDisabled) {
      if (type === CacheGetType.TYPE_ARRAY) return Promise.resolve([]);
      else if (type === CacheGetType.TYPE_OBJECT) return Promise.resolve(null);
      return Promise.resolve(null);
    }
    return this.client.get(`${this.prefix}:${key}`, type);
  }

  public static async getAll(pattern: string): Promise<any[]> {
    if (this.cacheDisabled) return Promise.resolve([]);
    return this.client.getAll(`${this.prefix}:${pattern}`);
  }

  public static async del(key): Promise<boolean> {
    if (this.cacheDisabled) return Promise.resolve(true);
    return this.client.del(`${this.prefix}:${key}`);
  }

  public static async delAll(scope: string, pattern: string): Promise<any[]> {
    if (this.cacheDisabled) return Promise.resolve([]);
    return this.client.delAll(scope, pattern);
  }

  public static async getList(
    scope: string,
    subKeys: string[],
  ): Promise<{
    list: any[];
    isNoneList: boolean;
  }> {
    if (this.cacheDisabled)
      return Promise.resolve({
        list: [],
        isNoneList: false,
      });
    return this.client.getList(scope, subKeys);
  }

  public static async setList(
    scope: string,
    subListKeys: string[],
    list: any[],
  ): Promise<boolean> {
    if (this.cacheDisabled) return Promise.resolve(true);
    return this.client.setList(scope, subListKeys, list);
  }

  public static async deepDel(
    scope: string,
    key: string,
    direction: string,
  ): Promise<boolean> {
    if (this.cacheDisabled) return Promise.resolve(true);
    return this.client.deepDel(scope, key, direction);
  }

  public static async appendToList(
    scope: string,
    subListKeys: string[],

    key: string,
  ): Promise<boolean> {
    if (this.cacheDisabled) return Promise.resolve(true);
    return this.client.appendToList(
      scope,
      subListKeys,
      `${this.prefix}:${key}`,
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
