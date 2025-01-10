import debug from 'debug';
import { Logger } from '@nestjs/common';
import type { ChainableCommander } from 'ioredis';
import type IORedis from 'ioredis';
import { CacheDelDirection, CacheGetType } from '~/utils/globals';
import { NC_REDIS_GRACE_TTL, NC_REDIS_TTL } from '~/helpers/redisHelpers';

const log = debug('nc:cache');
const logger = new Logger('CacheMgr');

/*
  - keys are stored as following:
    - simple key: nc:<orgs>:<scope>:<model_id_1>
      - value: { value: { ... }, parentKeys: [ "nc:<orgs>:<scope>:<model_id_1>:list" ], timestamp: 1234567890 }
      - stored as stringified JSON
    - list key: nc:<orgs>:<scope>:<model_id_1>:list
      - stored as SET
  - get returns `value` only
  - getRaw returns the whole cache object with metadata
*/

export default abstract class CacheMgr {
  client: IORedis;
  prefix: string;
  context: string;

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
    log(`${this.context}::del: deleting key ${key}`);
    if (Array.isArray(key)) {
      if (key.length) {
        return this.client.del(key);
      }
    } else if (key) {
      return this.client.del(key);
    }
  }

  // @ts-ignore
  private async getRaw(
    key: string,
    type?: string,
    skipTTL = false,
  ): Promise<any> {
    log(`${this.context}::getRaw: getting key ${key} with type ${type}`);
    if (type === CacheGetType.TYPE_ARRAY) {
      return this.client.smembers(key);
    } else {
      const res = await this.client.get(key);
      if (res) {
        try {
          const o = JSON.parse(res);
          if (typeof o === 'object') {
            if (
              o &&
              Object.keys(o).length === 0 &&
              Object.getPrototypeOf(o) === Object.prototype
            ) {
              log(`${this.context}::get: object is empty!`);
            }

            if (!skipTTL && o.timestamp) {
              const diff = Date.now() - o.timestamp;
              if (diff > NC_REDIS_GRACE_TTL * 1000) {
                await this.execRefreshTTL(key);
              }
            }

            return Promise.resolve(o);
          }
        } catch (e) {
          logger.error(`Bad value stored for key ${key} : ${res}`);
          return Promise.resolve(res);
        }
      }
      return Promise.resolve(res);
    }
  }

  // @ts-ignore
  async get(key: string, type: string): Promise<any> {
    return this.getRaw(key, type).then((res) => {
      if (res && res.value) {
        return res.value;
      }
      return res;
    });
  }

  // @ts-ignore
  async set(
    key: string,
    value: any,
    options: {
      // when we prepare beforehand, we don't need to prepare again
      skipPrepare?: boolean;
      // timestamp for the value, if not provided, it will be set to current time
      timestamp?: number;
    } = {
      skipPrepare: false,
    },
  ): Promise<any> {
    const { skipPrepare, timestamp } = options;

    if (typeof value !== 'undefined' && value) {
      log(
        `${this.context}::set: setting key ${key} with value ${this.stringify(
          value,
        )}`,
      );

      // if provided value is an array store it as a set
      if (Array.isArray(value) && value.length) {
        return new Promise((resolve) => {
          this.client
            .pipeline()
            .sadd(key, value)
            // - 60 seconds to avoid expiring list before any of its children
            .expire(key, NC_REDIS_TTL - 60)
            .exec((err) => {
              if (err) {
                logger.error(
                  `${
                    this.context
                  }::set: error setting key ${key} with value ${this.stringify(
                    value,
                  )}`,
                );
              }
              resolve(true);
            });
        });
      }

      if (!skipPrepare) {
        // try to get old key value
        const keyValue = await this.getRaw(key);
        // prepare new key value
        value = this.prepareValue({
          value,
          parentKeys: this.getParents(keyValue),
          timestamp,
        });
      }

      return this.client
        .set(
          key,
          JSON.stringify(value, this.getCircularReplacer()),
          'EX',
          NC_REDIS_TTL,
        )
        .then(async () => {
          await this.execRefreshTTL(key, timestamp);
          return true;
        });
    } else {
      log(`${this.context}::set: value is empty for ${key}. Skipping ...`);
      return Promise.resolve(true);
    }
  }

  // @ts-ignore
  async setExpiring(
    key: string,
    value: any,
    seconds: number,
    options: {
      // when we prepare beforehand, we don't need to prepare again
      skipPrepare?: boolean;
      // timestamp for the value, if not provided, it will be set to current time
      timestamp?: number;
    } = {
      skipPrepare: false,
    },
  ): Promise<any> {
    const { skipPrepare, timestamp } = options;

    if (typeof value !== 'undefined' && value) {
      log(
        `${
          this.context
        }::setExpiring: setting key ${key} with value ${this.stringify(value)}`,
      );

      if (Array.isArray(value) && value.length) {
        return new Promise((resolve) => {
          this.client
            .pipeline()
            .sadd(key, value)
            .expire(key, seconds)
            .exec((err) => {
              if (err) {
                logger.error(
                  `${
                    this.context
                  }::set: error setting key ${key} with value ${this.stringify(
                    value,
                  )}`,
                );
              }
              resolve(true);
            });
        });
      }

      if (!skipPrepare) {
        // try to get old key value
        const keyValue = await this.getRaw(key);
        // prepare new key value
        value = this.prepareValue({
          value,
          parentKeys: this.getParents(keyValue),
          timestamp,
        });
      }

      return this.client.set(
        key,
        JSON.stringify(value, this.getCircularReplacer()),
        'EX',
        seconds,
      );
    } else {
      log(`${this.context}::set: value is empty for ${key}. Skipping ...`);
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
    orderBy?: {
      key: string;
      dir?: 'asc' | 'desc';
      isString?: boolean;
    },
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
    log(`${this.context}::getList: getting list with key ${key}`);
    const isNoneList = arr.length && arr.includes('NONE');

    if (isNoneList || !arr.length) {
      return Promise.resolve({
        list: [],
        isNoneList,
      });
    }

    log(`${this.context}::getList: getting list with keys ${arr}`);
    const values = await this.client.mget(arr);

    if (values.some((v) => v === null)) {
      // FALLBACK: a key is missing from list, this should never happen
      logger.error(`${this.context}::getList: missing value for ${key}`);
      const allParents = [];
      // get all parents from children
      values.forEach((v) => {
        if (v) {
          try {
            const o = JSON.parse(v);
            if (typeof o === 'object') {
              allParents.push(...this.getParents(o));
            }
          } catch (e) {
            logger.error(
              `${this.context}::getList: Bad value stored for key ${
                arr[0]
              } : ${this.stringify(v)}`,
            );
          }
        }
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

    if (values.length) {
      try {
        const o = JSON.parse(values[0]);
        if (typeof o === 'object') {
          const diff = Date.now() - o.timestamp;
          if (diff > NC_REDIS_GRACE_TTL * 1000) {
            await this.execRefreshTTL(key);
          }
        }
      } catch (e) {
        logger.error(
          `${this.context}::getList: Bad value stored for key ${arr[0]} : ${values[0]}`,
        );
      }
    }
    const list = values.map((res) => {
      try {
        const o = JSON.parse(res);
        if (typeof o === 'object') {
          return o.value;
        }
      } catch (e) {
        return res;
      }
      return res;
    });

    // Check if orderBy parameter is provided and valid
    if (orderBy?.key) {
      // Destructure the properties from orderBy object
      const { key, dir, isString } = orderBy;

      // Determine the multiplier for sorting order: -1 for descending, 1 for ascending
      const orderMultiplier = dir === 'desc' ? -1 : 1;

      // Sort the values array based on the specified property
      list.sort((a, b) => {
        // Get the property values from a and b
        const aValue = a?.[key];
        const bValue = b?.[key];

        // If aValue is null or undefined, move it to the end
        if (aValue === null || aValue === undefined) return 1;
        // If bValue is null or undefined, move it to the end
        if (bValue === null || bValue === undefined) return -1;

        if (isString) {
          // If the property is a string, use localeCompare for comparison
          return orderMultiplier * String(aValue).localeCompare(String(bValue));
        }
        // If the property is a number, subtract the values directly
        return orderMultiplier * (aValue - bValue);
      });
    }

    return {
      list,
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

    // remove existing list
    await this.deepDel(listKey, CacheDelDirection.PARENT_TO_CHILD);
    const listOfGetKeys = [];

    for (const o of list) {
      // construct key for Get
      let getKey = `${this.prefix}:${scope}:${o.id}`;
      if (props.length) {
        const propValues = props.map((p) => o[p]);
        // e.g. nc:<orgs>:<scope>:<prop_value_1>:<prop_value_2>
        getKey = `${this.prefix}:${scope}:${propValues.join(':')}`;
      }
      log(`${this.context}::setList: get key ${getKey}`);
      // get key
      let rawValue = await this.getRaw(getKey, CacheGetType.TYPE_OBJECT);
      if (rawValue) {
        log(`${this.context}::setList: preparing key ${getKey}`);
        // prepare key
        rawValue = this.prepareValue({
          value: o,
          parentKeys: this.getParents(rawValue),
          newKey: listKey,
          timestamp,
        });
      } else {
        rawValue = this.prepareValue({
          value: o,
          parentKeys: [listKey],
          timestamp,
        });
      }
      // set key
      log(`${this.context}::setList: setting key ${getKey}`);
      await this.set(getKey, rawValue, {
        skipPrepare: true,
        timestamp,
      });
      // push key to list
      listOfGetKeys.push(getKey);
    }
    // set list
    log(`${this.context}::setList: setting list with key ${listKey}`);
    return this.set(listKey, listOfGetKeys);
  }

  async deepDel(key: string, direction: string): Promise<boolean> {
    log(`${this.context}::deepDel: choose direction ${direction}`);
    if (direction === CacheDelDirection.CHILD_TO_PARENT) {
      const childKey = await this.getRaw(key, CacheGetType.TYPE_OBJECT);
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
        log(`${this.context}::deepDel: remove listKey ${listKey}`);
        await this.del(listKey);
        if (list.length) {
          // set target list
          log(`${this.context}::deepDel: set key ${listKey}`);
          await this.set(listKey, list);
        }
      }
      log(`${this.context}::deepDel: remove key ${key}`);
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
    log(`${this.context}::appendToList: append key ${key} to ${listKey}`);
    let list = await this.get(listKey, CacheGetType.TYPE_ARRAY);

    if (!list || !list.length) {
      return false;
    }

    if (list.includes('NONE')) {
      list = [];
      await this.del(listKey);
    }

    log(`${this.context}::appendToList: get key ${key}`);
    // get Get Key
    const rawValue = await this.getRaw(key, CacheGetType.TYPE_OBJECT);
    log(`${this.context}::appendToList: preparing key ${key}`);
    if (!rawValue) {
      // FALLBACK: this is to get rid of all keys that would be effected by this (should never happen)
      logger.error(`${this.context}::appendToList: value is empty for ${key}`);
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
    const preparedValue = this.prepareValue({
      value: rawValue.value ?? rawValue,
      parentKeys: this.getParents(rawValue),
      newKey: listKey,
    });
    // set Get Key
    log(`${this.context}::appendToList: setting key ${key}`);
    await this.set(key, preparedValue, {
      skipPrepare: true,
    });

    list.push(key);
    return this.set(listKey, list);
  }

  async update(key: string, value: any): Promise<boolean> {
    let o = await this.get(key, CacheGetType.TYPE_OBJECT);
    if (o) {
      // update data
      o = { ...o, ...value };
      // set cache
      await this.set(key, o);
    }
    return true;
  }

  // wrap value with metadata
  prepareValue(args: {
    value: any;
    parentKeys: string[];
    newKey?: string;
    timestamp?: number;
  }) {
    const { value, parentKeys, newKey, timestamp } = args;

    if (newKey && !parentKeys.includes(newKey)) {
      parentKeys.push(newKey);
    }

    const cacheObj = {
      value,
      parentKeys,
      timestamp: timestamp || Date.now(),
    };

    return cacheObj;
  }

  getParents(rawValue) {
    if (rawValue && rawValue.parentKeys) {
      return rawValue.parentKeys;
    } else if (!rawValue) {
      return [];
    } else {
      logger.error(
        `${this.context}::getParents: parentKeys not found ${JSON.stringify(
          rawValue,
        )}`,
      );
      return [];
    }
  }

  async execRefreshTTL(keys: string, timestamp?: number): Promise<void> {
    const p = await this.refreshTTL(this.client.pipeline(), keys, timestamp);
    await p.exec();
  }

  async refreshTTL(
    pipeline: ChainableCommander,
    key: string,
    timestamp?: number,
  ): Promise<ChainableCommander> {
    log(`${this.context}::refreshTTL: refreshing TTL for ${key}`);
    const isParent = /:list$/.test(key);
    timestamp = timestamp || Date.now();
    if (isParent) {
      const list =
        (await this.getRaw(key, CacheGetType.TYPE_ARRAY, true)) || [];
      if (list && list.length) {
        const listValues = await this.client.mget(list);
        for (const [i, v] of listValues.entries()) {
          const key = list[i];
          if (v) {
            try {
              const o = JSON.parse(v);
              if (typeof o === 'object') {
                if (o.timestamp !== timestamp) {
                  o.timestamp = timestamp;
                  pipeline.set(
                    key,
                    JSON.stringify(o, this.getCircularReplacer()),
                    'EX',
                    NC_REDIS_TTL,
                  );
                }
              }
            } catch (e) {
              logger.error(
                `${
                  this.context
                }::refreshTTL: Bad value stored for key ${key} : ${this.stringify(
                  v,
                )}`,
              );
            }
          }
        }
        pipeline.expire(key, NC_REDIS_TTL - 60);
      }
    } else {
      const rawValue = await this.getRaw(key, null, true);
      if (rawValue) {
        if (rawValue.parentKeys && rawValue.parentKeys.length) {
          for (const parent of rawValue.parentKeys) {
            pipeline = await this.refreshTTL(pipeline, parent, timestamp);
          }
        } else {
          if (rawValue.timestamp !== timestamp) {
            rawValue.timestamp = timestamp;
            pipeline.set(
              key,
              JSON.stringify(rawValue, this.getCircularReplacer()),
              'EX',
              NC_REDIS_TTL,
            );
          }
        }
      }
    }

    return pipeline;
  }

  async destroy(): Promise<boolean> {
    log('${this.context}::destroy: destroy redis');
    return this.client.flushdb().then((r) => r === 'OK');
  }

  async export(): Promise<any> {
    log('${this.context}::export: export data');
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

  // function to stringify value if having null prototype
  private stringify(value: any) {
    if (Object.prototype.hasOwnProperty.call(value, 'toString')) {
      return value;
    }
    return JSON.stringify(value, this.getCircularReplacer());
  }
}
