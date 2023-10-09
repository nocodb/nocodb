import debug from 'debug';
import Redis from 'ioredis';
import CacheMgr from './CacheMgr';
import { CacheDelDirection, CacheGetType, CacheScope } from '~/utils/globals';

const log = debug('nc:cache');

export default class RedisCacheMgr extends CacheMgr {
  client: any;
  prefix: string;

  constructor(config: any) {
    super();
    this.client = new Redis(config);

    // avoid flushing db in worker container
    if (process.env.NC_WORKER_CONTAINER !== 'true') {
      // flush the existing db with selected key (Default: 0)
      this.client.flushdb();
    }

    // TODO(cache): fetch orgs once it's implemented
    const orgs = 'noco';
    this.prefix = `nc:${orgs}`;
  }

  // avoid circular structure to JSON
  getCircularReplacer = () => {
    const seen = new WeakSet();
    return (_, value) => {
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) {
          return;
        }
        seen.add(value);
      }
      return value;
    };
  };

  // @ts-ignore
  async del(key: string): Promise<any> {
    log(`RedisCacheMgr::del: deleting key ${key}`);
    return this.client.del(key);
  }

  // @ts-ignore
  async get(key: string, type: string): Promise<any> {
    log(`RedisCacheMgr::get: getting key ${key} with type ${type}`);
    if (type === CacheGetType.TYPE_ARRAY) {
      return this.client.smembers(key);
    } else if (type === CacheGetType.TYPE_OBJECT) {
      const res = await this.client.get(key);
      try {
        const o = JSON.parse(res);
        if (typeof o === 'object') {
          if (
            o &&
            Object.keys(o).length === 0 &&
            Object.getPrototypeOf(o) === Object.prototype
          ) {
            log(`RedisCacheMgr::get: object is empty!`);
          }
          return Promise.resolve(o);
        }
      } catch (e) {
        return Promise.resolve(res);
      }
      return Promise.resolve(res);
    } else if (type === CacheGetType.TYPE_STRING) {
      return await this.client.get(key);
    }
    log(`Invalid CacheGetType: ${type}`);
    return Promise.resolve(false);
  }

  // @ts-ignore
  async set(key: string, value: any): Promise<any> {
    if (typeof value !== 'undefined' && value) {
      log(`RedisCacheMgr::set: setting key ${key} with value ${value}`);
      if (typeof value === 'object') {
        if (Array.isArray(value) && value.length) {
          return this.client.sadd(key, value);
        }
        return this.client.set(
          key,
          JSON.stringify(value, this.getCircularReplacer()),
        );
      }
      return this.client.set(key, value);
    } else {
      log(`RedisCacheMgr::set: value is empty for ${key}. Skipping ...`);
      return Promise.resolve(true);
    }
  }

  // @ts-ignore
  async setExpiring(key: string, value: any, seconds: number): Promise<any> {
    if (typeof value !== 'undefined' && value) {
      log(
        `RedisCacheMgr::setExpiring: setting key ${key} with value ${value} for ${seconds} seconds`,
      );
      if (typeof value === 'object') {
        if (Array.isArray(value) && value.length) {
          return this.client.sadd(key, value);
        }
        return this.client.set(
          key,
          JSON.stringify(value, this.getCircularReplacer()),
          'EX',
          seconds,
        );
      }
      return this.client.set(key, value, 'EX', seconds);
    } else {
      log(`RedisCacheMgr::set: value is empty for ${key}. Skipping ...`);
      return Promise.resolve(true);
    }
  }

  // @ts-ignore
  async incrby(key: string, value = 1): Promise<any> {
    return this.client.incrby(key, value);
  }

  // @ts-ignore
  async getAll(pattern: string): Promise<any> {
    return this.client.hgetall(pattern);
  }

  // @ts-ignore
  async delAll(scope: string, pattern: string): Promise<any[]> {
    // Example: nc:<orgs>:model:*:<id>
    const keys = await this.client.keys(`${this.prefix}:${scope}:${pattern}`);
    log(
      `RedisCacheMgr::delAll: deleting all keys with pattern ${this.prefix}:${scope}:${pattern}`,
    );
    await Promise.all(
      keys.map(async (k) => {
        await this.deepDel(scope, k, CacheDelDirection.CHILD_TO_PARENT);
      }),
    );
    return Promise.all(
      keys.map(async (k) => {
        await this.del(k);
      }),
    );
  }

  async getList(
    scope: string,
    subKeys: string[],
  ): Promise<{
    list: any[];
    isNoneList: boolean;
  }> {
    // remove null from arrays
    subKeys = subKeys.filter((k) => k);
    // e.g. key = nc:<orgs>:<scope>:<project_id_1>:<source_id_1>:list
    const key =
      subKeys.length === 0
        ? `${this.prefix}:${scope}:list`
        : `${this.prefix}:${scope}:${subKeys.join(':')}:list`;
    // e.g. arr = ["nc:<orgs>:<scope>:<model_id_1>", "nc:<orgs>:<scope>:<model_id_2>"]
    const arr = (await this.get(key, CacheGetType.TYPE_ARRAY)) || [];
    log(`RedisCacheMgr::getList: getting list with key ${key}`);
    const isNoneList = arr.length && arr.includes('NONE');

    if (isNoneList) {
      return Promise.resolve({
        list: [],
        isNoneList,
      });
    }

    return {
      list: await Promise.all(
        arr.map(async (k) => await this.get(k, CacheGetType.TYPE_OBJECT)),
      ),
      isNoneList,
    };
  }

  async setList(
    scope: string,
    subListKeys: string[],
    list: any[],
  ): Promise<boolean> {
    // remove null from arrays
    subListKeys = subListKeys.filter((k) => k);
    // construct key for List
    // e.g. nc:<orgs>:<scope>:<project_id_1>:<source_id_1>:list
    const listKey =
      subListKeys.length === 0
        ? `${this.prefix}:${scope}:list`
        : `${this.prefix}:${scope}:${subListKeys.join(':')}:list`;
    if (!list.length) {
      // Set NONE here so that it won't hit the DB on each page load
      return this.set(listKey, ['NONE']);
    }
    // fetch existing list
    const listOfGetKeys =
      (await this.get(listKey, CacheGetType.TYPE_ARRAY)) || [];
    for (const o of list) {
      // construct key for Get
      // e.g. nc:<orgs>:<scope>:<model_id_1>
      let getKey = `${this.prefix}:${scope}:${o.id}`;
      // special case - MODEL_ROLE_VISIBILITY
      if (scope === CacheScope.MODEL_ROLE_VISIBILITY) {
        getKey = `${this.prefix}:${scope}:${o.fk_view_id}:${o.role}`;
      }
      // set Get Key
      log(`RedisCacheMgr::setList: setting key ${getKey}`);
      await this.set(getKey, JSON.stringify(o, this.getCircularReplacer()));
      // push Get Key to List
      listOfGetKeys.push(getKey);
    }
    // set List Key
    log(`RedisCacheMgr::setList: setting list with key ${listKey}`);
    return this.set(listKey, listOfGetKeys);
  }

  async deepDel(
    scope: string,
    key: string,
    direction: string,
  ): Promise<boolean> {
    key = `${this.prefix}:${key}`;
    log(`RedisCacheMgr::deepDel: choose direction ${direction}`);
    if (direction === CacheDelDirection.CHILD_TO_PARENT) {
      // given a child key, delete all keys in corresponding parent lists
      const scopeList = await this.client.keys(`${this.prefix}:${scope}*list`);
      for (const listKey of scopeList) {
        // get target list
        let list = (await this.get(listKey, CacheGetType.TYPE_ARRAY)) || [];
        if (!list.length) {
          continue;
        }
        // remove target Key
        list = list.filter((k) => k !== key);
        // delete list
        log(`RedisCacheMgr::deepDel: remove listKey ${listKey}`);
        await this.del(listKey);
        if (list.length) {
          // set target list
          log(`RedisCacheMgr::deepDel: set key ${listKey}`);
          await this.del(listKey);
          await this.set(listKey, list);
        }
      }
      log(`RedisCacheMgr::deepDel: remove key ${key}`);
      return await this.del(key);
    } else if (direction === CacheDelDirection.PARENT_TO_CHILD) {
      // given a list key, delete all the children
      const listOfChildren = await this.get(key, CacheGetType.TYPE_ARRAY);
      // delete each child key
      await Promise.all(listOfChildren.map(async (k) => await this.del(k)));
      // delete list key
      return await this.del(key);
    } else {
      log(`Invalid deepDel direction found : ${direction}`);
      return Promise.resolve(false);
    }
  }

  async appendToList(
    scope: string,
    subListKeys: string[],
    key: string,
  ): Promise<boolean> {
    // remove null from arrays
    subListKeys = subListKeys.filter((k) => k);
    // e.g. key = nc:<orgs>:<scope>:<project_id_1>:<source_id_1>:list
    const listKey =
      subListKeys.length === 0
        ? `${this.prefix}:${scope}:list`
        : `${this.prefix}:${scope}:${subListKeys.join(':')}:list`;
    log(`RedisCacheMgr::appendToList: append key ${key} to ${listKey}`);
    let list = (await this.get(listKey, CacheGetType.TYPE_ARRAY)) || [];
    if (list.length && list.includes('NONE')) {
      list = [];
      await this.del(listKey);
    }
    list.push(key);
    return this.set(listKey, list);
  }

  async destroy(): Promise<boolean> {
    log('RedisCacheMgr::destroy: destroy redis');
    return this.client.flushdb();
  }

  async export(): Promise<any> {
    log('RedisCacheMgr::export: export data');
    const data = await this.client.keys('*');
    const res = {};
    return await Promise.all(
      data.map(async (k) => {
        res[k] = await this.get(
          k,
          k.slice(-4) === 'list'
            ? CacheGetType.TYPE_ARRAY
            : CacheGetType.TYPE_OBJECT,
        );
      }),
    ).then(() => {
      return res;
    });
  }
}
