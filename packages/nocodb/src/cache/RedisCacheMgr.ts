import debug from 'debug';
import Redis from 'ioredis';
import CacheMgr from './CacheMgr';
import {
  CacheDelDirection,
  CacheGetType,
  CacheListProp,
  CacheMetaSplitter,
  CacheTimestampProp,
} from '~/utils/globals';

const log = debug('nc:cache');

export default class RedisCacheMgr extends CacheMgr {
  client: Redis;
  prefix: string;

  constructor(config: any) {
    super();
    this.client = new Redis(config);

    // avoid flushing db in worker container
    if (
      process.env.NC_WORKER_CONTAINER !== 'true' &&
      process.env.NC_CLOUD !== 'true'
    ) {
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
  async del(key: string[] | string): Promise<any> {
    log(`RedisCacheMgr::del: deleting key ${key}`);
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
      } catch (e) {}
      const valueHelper = res.split(CacheMetaSplitter);
      return Promise.resolve(valueHelper[0]);
    } else if (type === CacheGetType.TYPE_STRING) {
      return this.client.get(key).then((res) => {
        if (!res) {
          return res;
        }
        const valueHelper = res.split(CacheMetaSplitter);
        return valueHelper[0];
      });
    }
    log(`Invalid CacheGetType: ${type}`);
    return Promise.resolve(false);
  }

  // @ts-ignore
  async set(
    key: string,
    value: any,
    options: {
      skipPrepare?: boolean;
      timestamp?: number;
    } = {
      skipPrepare: false,
    },
  ): Promise<any> {
    const { skipPrepare, timestamp } = options;

    if (typeof value !== 'undefined' && value) {
      log(`RedisCacheMgr::set: setting key ${key} with value ${value}`);

      if (typeof value === 'object') {
        if (Array.isArray(value) && value.length) {
          return this.client.sadd(key, value);
        }

        if (!skipPrepare) {
          // try to get old key value
          const keyValue = await this.get(key, CacheGetType.TYPE_OBJECT);
          // prepare new key value
          value = this.prepareValue(value, {
            parentKeys: this.getParents(keyValue),
            timestamp,
          });
        }

        return this.client.set(
          key,
          JSON.stringify(value, this.getCircularReplacer()),
        );
      }

      if (!skipPrepare) {
        // try to get old key value
        const keyValue = await this.get(key, CacheGetType.TYPE_OBJECT);
        // prepare new key value
        value = this.prepareValue(value.toString(), {
          parentKeys: this.getParents(keyValue),
          timestamp,
        });
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

    if (isNoneList || !arr.length) {
      return Promise.resolve({
        list: [],
        isNoneList,
      });
    }

    log(`RedisCacheMgr::getList: getting list with keys ${arr}`);
    const values = await this.client.mget(arr);

    if (values.some((v) => v === null)) {
      // FALLBACK: a key is missing from list, this should never happen
      console.error(`RedisCacheMgr::getList: missing value for ${key}`);
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
          await this.deepDel(p, CacheDelDirection.PARENT_TO_CHILD);
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

    // timestamp for list
    const timestamp = Date.now();

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
      log(`RedisCacheMgr::setList: get key ${getKey}`);
      // get key
      let value = await this.get(getKey, CacheGetType.TYPE_OBJECT);
      if (value) {
        log(`RedisCacheMgr::setList: preparing key ${getKey}`);
        // prepare key
        value = this.prepareValue(o, {
          parentKeys: this.getParents(value).concat(listKey),
          timestamp,
        });
      } else {
        value = this.prepareValue(o, {
          parentKeys: [listKey],
          timestamp,
        });
      }
      // set key
      log(`RedisCacheMgr::setList: setting key ${getKey}`);
      await this.set(
        getKey,
        JSON.stringify(value, this.getCircularReplacer()),
        {
          skipPrepare: true,
          timestamp,
        },
      );
      // push key to list
      listOfGetKeys.push(getKey);
    }
    // set list
    log(`RedisCacheMgr::setList: setting list with key ${listKey}`);
    return this.set(listKey, listOfGetKeys);
  }

  async deepDel(key: string, direction: string): Promise<boolean> {
    log(`RedisCacheMgr::deepDel: choose direction ${direction}`);
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
        log(`RedisCacheMgr::deepDel: remove listKey ${listKey}`);
        await this.del(listKey);
        if (list.length) {
          // set target list
          log(`RedisCacheMgr::deepDel: set key ${listKey}`);
          await this.set(listKey, list);
        }
      }
      log(`RedisCacheMgr::deepDel: remove key ${key}`);
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
    log(`RedisCacheMgr::appendToList: append key ${key} to ${listKey}`);
    let list = await this.get(listKey, CacheGetType.TYPE_ARRAY);

    if (!list || !list.length) {
      return false;
    }

    if (list.includes('NONE')) {
      list = [];
      await this.del(listKey);
    }

    log(`RedisCacheMgr::appendToList: get key ${key}`);
    // get Get Key
    const value = await this.get(key, CacheGetType.TYPE_OBJECT);
    log(`RedisCacheMgr::appendToList: preparing key ${key}`);
    if (!value) {
      // FALLBACK: this is to get rid of all keys that would be effected by this (should never happen)
      console.error(`RedisCacheMgr::appendToList: value is empty for ${key}`);
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
          await this.deepDel(p, CacheDelDirection.PARENT_TO_CHILD);
        }),
      );
      return false;
    }
    // prepare Get Key
    const preparedValue = this.prepareValue(value, {
      parentKeys: this.getParents(value).concat(listKey),
    });
    // set Get Key
    log(`RedisCacheMgr::appendToList: setting key ${key}`);
    await this.set(
      key,
      JSON.stringify(preparedValue, this.getCircularReplacer()),
      {
        skipPrepare: true,
      },
    );

    list.push(key);
    return this.set(listKey, list);
  }

  prepareValue(
    value,
    options: {
      parentKeys: string[];
      timestamp?: number;
    },
  ) {
    const { parentKeys, timestamp } = options;

    if (value && typeof value === 'object') {
      value[CacheListProp] = parentKeys;

      if (timestamp) {
        value[CacheTimestampProp] = timestamp;
      } else {
        value[CacheTimestampProp] = Date.now();
      }
    } else if (value && typeof value === 'string') {
      const metaHelper = value.split(CacheMetaSplitter);
      if (metaHelper.length > 1) {
        const keyVal = metaHelper[0];
        const keyMeta = metaHelper[1];
        try {
          const meta = JSON.parse(keyMeta);
          meta[CacheListProp] = parentKeys;
          meta[CacheTimestampProp] = timestamp || Date.now();
          value = `${keyVal}${CacheMetaSplitter}${JSON.stringify(meta)}`;
        } catch (e) {
          console.error(
            `RedisCacheMgr::prepareValue: keyValue meta is not JSON`,
            keyMeta,
          );
          throw new Error(
            `RedisCacheMgr::prepareValue: keyValue meta is not JSON`,
          );
        }
      } else {
        const meta = {
          [CacheListProp]: parentKeys,
          [CacheTimestampProp]: timestamp || Date.now(),
        };
        value = `${value}${CacheMetaSplitter}${JSON.stringify(meta)}`;
      }
    } else if (value) {
      console.error(
        `RedisCacheMgr::prepareValue: keyValue is not object or string`,
        value,
      );
      throw new Error(
        `RedisCacheMgr::prepareValue: keyValue is not object or string`,
      );
    }
    return value;
  }

  async refreshTTL(key: string): Promise<void> {
    log(`RedisCacheMgr::refreshTTL: refreshing key ${key}`);
    const value = await this.get(key, CacheGetType.TYPE_OBJECT);
    if (value) {
      const parents = this.getParents(value);
      if (parents.length) {
        for (const p of parents) {
          const childList = await this.get(p, CacheGetType.TYPE_ARRAY);
          for (const c of childList) {
            const childValue = await this.get(c, CacheGetType.TYPE_OBJECT);
            await this.set(c, childValue, { timestamp: Date.now() });
          }
        }
      } else {
        await this.set(key, value, { timestamp: Date.now() });
      }
    }
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
    log('RedisCacheMgr::destroy: destroy redis');
    return this.client.flushdb().then((r) => r === 'OK');
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
