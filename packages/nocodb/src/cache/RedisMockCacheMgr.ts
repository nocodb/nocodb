import debug from 'debug';
import Redis from 'ioredis-mock';
import CacheMgr from './CacheMgr';
import type IORedis from 'ioredis';
import {
  CacheDelDirection,
  CacheGetType,
  CacheListProp,
} from '~/utils/globals';
const log = debug('nc:cache');

export default class RedisMockCacheMgr extends CacheMgr {
  client: IORedis;
  prefix: string;

  constructor() {
    super();
    this.client = new Redis();
    // flush the existing db with selected key (Default: 0)
    this.client.flushdb();

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
  async del(key: string[] | string): Promise<any> {
    log(`RedisMockCacheMgr::del: deleting key ${key}`);
    if (Array.isArray(key)) {
      if (key.length) {
        return this.client.del(key);
      }
    } else if (key) {
      return this.client.del(key);
    }
  }

  // @ts-ignore
  async get(key: string, type: string): Promise<any> {
    log(`RedisMockCacheMgr::get: getting key ${key} with type ${type}`);
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
            log(`RedisMockCacheMgr::get: object is empty!`);
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
      log(`RedisMockCacheMgr::set: setting key ${key} with value ${value}`);
      if (typeof value === 'object') {
        if (Array.isArray(value) && value.length) {
          return this.client.sadd(key, value);
        }
        const keyValue = await this.get(key, CacheGetType.TYPE_OBJECT);
        if (keyValue) {
          value = await this.prepareValue(value, this.getParents(keyValue));
        }
        return this.client.set(
          key,
          JSON.stringify(value, this.getCircularReplacer()),
        );
      }
      return this.client.set(key, value);
    } else {
      log(`RedisMockCacheMgr::set: value is empty for ${key}. Skipping ...`);
      return Promise.resolve(true);
    }
  }

  // @ts-ignore
  async setExpiring(key: string, value: any, seconds: number): Promise<any> {
    if (typeof value !== 'undefined' && value) {
      log(
        `RedisMockCacheMgr::setExpiring: setting key ${key} with value ${value} for ${seconds} seconds`,
      );

      // TODO: better way to handle expiration in mock redis
      setTimeout(() => {
        this.del(key);
      }, seconds * 1000);

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
      log(`RedisMockCacheMgr::set: value is empty for ${key}. Skipping ...`);
      return Promise.resolve(true);
    }
  }

  // @ts-ignore
  async incrby(key: string, value = 1): Promise<any> {
    return this.client.incrby(key, value);
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
    log(`RedisMockCacheMgr::getList: getting list with key ${key}`);
    const isNoneList = arr.length && arr[0] === 'NONE';

    if (isNoneList || !arr.length) {
      return Promise.resolve({
        list: [],
        isNoneList,
      });
    }

    log(`RedisMockCacheMgr::getList: getting list with keys ${arr}`);
    const values = await this.client.mget(arr);

    if (values.some((v) => v === null)) {
      // FALLBACK: a key is missing from list, this should never happen
      console.error(`RedisMockCacheMgr::getList: missing value for ${key}`);
      const allParents = [];
      // get all parents from children
      values.forEach((v) => {
        allParents.push(...this.getParents(v));
      });
      // remove duplicates
      const uniqueParents = [...new Set(allParents)];
      // delete all parents and children
      await Promise.all(
        uniqueParents.map(async (p) => {
          await this.deepDel(scope, p, CacheDelDirection.PARENT_TO_CHILD);
        }),
      );
      return Promise.resolve({
        list: [],
        isNoneList,
      });
    }

    return {
      list: values.map((res) => {
        try {
          const o = JSON.parse(res);
          if (typeof o === 'object') {
            return o;
          }
        } catch (e) {
          return res;
        }
        return res;
      }),
      isNoneList,
    };
  }

  async setList(
    scope: string,
    subListKeys: string[],
    list: any[],
    props: string[] = [],
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
      let getKey = `${this.prefix}:${scope}:${o.id}`;
      if (props.length) {
        const propValues = props.map((p) => o[p]);
        // e.g. nc:<orgs>:<scope>:<prop_value_1>:<prop_value_2>
        getKey = `${this.prefix}:${scope}:${propValues.join(':')}`;
      }
      log(`RedisMockCacheMgr::setList: get key ${getKey}`);
      // get Get Key
      let value = await this.get(getKey, CacheGetType.TYPE_OBJECT);
      if (value) {
        log(`RedisMockCacheMgr::setList: preparing key ${getKey}`);
        // prepare Get Key
        value = await this.prepareValue(o, this.getParents(value), listKey);
      } else {
        value = await this.prepareValue(o, [], listKey);
      }
      // set Get Key
      log(`RedisMockCacheMgr::setList: setting key ${getKey}`);
      await this.set(getKey, JSON.stringify(value, this.getCircularReplacer()));
      // push Get Key to List
      listOfGetKeys.push(getKey);
    }
    // set List Key
    log(`RedisMockCacheMgr::setList: setting list with key ${listKey}`);
    return this.set(listKey, listOfGetKeys);
  }

  async deepDel(
    scope: string,
    key: string,
    direction: string,
  ): Promise<boolean> {
    log(`RedisMockCacheMgr::deepDel: choose direction ${direction}`);
    if (direction === CacheDelDirection.CHILD_TO_PARENT) {
      const childKey = await this.get(key, CacheGetType.TYPE_OBJECT);
      // given a child key, delete all keys in corresponding parent lists
      const scopeList = this.getParents(childKey);
      for (const listKey of scopeList) {
        // get target list
        let list = (await this.get(listKey, CacheGetType.TYPE_ARRAY)) || [];
        if (!list.length) {
          continue;
        }
        // remove target Key
        list = list.filter((k) => k !== key);
        // delete list
        log(`RedisMockCacheMgr::deepDel: remove listKey ${listKey}`);
        await this.del(listKey);
        if (list.length) {
          // set target list
          log(`RedisMockCacheMgr::deepDel: set key ${listKey}`);
          await this.set(listKey, list);
        }
      }
      log(`RedisMockCacheMgr::deepDel: remove key ${key}`);
      return await this.del(key);
    } else if (direction === CacheDelDirection.PARENT_TO_CHILD) {
      key = /:list$/.test(key) ? key : `${key}:list`;
      // given a list key, delete all the children
      const listOfChildren = await this.get(key, CacheGetType.TYPE_ARRAY);
      // delete each child key
      await this.del(listOfChildren);
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
    log(`RedisMockCacheMgr::appendToList: append key ${key} to ${listKey}`);
    let list = await this.get(listKey, CacheGetType.TYPE_ARRAY);

    if (!list || !list.length) {
      return false;
    }

    if (list[0] === 'NONE') {
      list = [];
      await this.del(listKey);
    }

    log(`RedisMockCacheMgr::appendToList: get key ${key}`);
    // get Get Key
    const value = await this.get(key, CacheGetType.TYPE_OBJECT);
    log(`RedisMockCacheMgr::appendToList: preparing key ${key}`);
    if (!value) {
      // FALLBACK: this is to get rid of all keys that would be effected by this (should never happen)
      console.error(
        `RedisMockCacheMgr::appendToList: value is empty for ${key}`,
      );
      const allParents = [];
      // get all children
      const listValues = await this.getList(scope, subListKeys);
      // get all parents from children
      listValues.list.forEach((v) => {
        allParents.push(...this.getParents(v));
      });
      // remove duplicates
      const uniqueParents = [...new Set(allParents)];
      // delete all parents and children
      await Promise.all(
        uniqueParents.map(async (p) => {
          await this.deepDel(scope, p, CacheDelDirection.PARENT_TO_CHILD);
        }),
      );
      return false;
    }
    // prepare Get Key
    const preparedValue = await this.prepareValue(
      value,
      this.getParents(value),
      listKey,
    );
    // set Get Key
    log(`RedisMockCacheMgr::appendToList: setting key ${key}`);
    await this.set(
      key,
      JSON.stringify(preparedValue, this.getCircularReplacer()),
    );

    list.push(key);
    return this.set(listKey, list);
  }

  prepareValue(value, listKeys = [], newParent?) {
    if (newParent) {
      listKeys.push(newParent);
    }

    if (value && typeof value === 'object') {
      value[CacheListProp] = listKeys;
    } else if (value && typeof value === 'string') {
      const keyHelper = value.split(CacheListProp);
      if (listKeys.length) {
        value = `${keyHelper[0]}${CacheListProp}${listKeys.join(',')}`;
      }
    } else if (value) {
      console.error(
        `RedisMockCacheMgr::prepareListKey: keyValue is not object or string`,
        value,
      );
      throw new Error(
        `RedisMockCacheMgr::prepareListKey: keyValue is not object or string`,
      );
    }
    return value;
  }

  getParents(value) {
    if (value && typeof value === 'object') {
      if (CacheListProp in value) {
        const listsForKey = value[CacheListProp];
        if (listsForKey && listsForKey.length) {
          return listsForKey;
        }
      }
    } else if (value && typeof value === 'string') {
      if (value.includes(CacheListProp)) {
        const keyHelper = value.split(CacheListProp);
        const listsForKey = keyHelper[1].split(',');
        if (listsForKey.length) {
          return listsForKey;
        }
      }
    }
    return [];
  }

  async destroy(): Promise<boolean> {
    log('RedisMockCacheMgr::destroy: destroy redis');
    return this.client.flushdb().then((r) => r === 'OK');
  }

  async export(): Promise<any> {
    log('RedisMockCacheMgr::export: export data');
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
