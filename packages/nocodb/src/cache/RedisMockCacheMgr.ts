import debug from 'debug';
import Redis from 'ioredis-mock';
import CacheMgr from './CacheMgr';
import { CACHE_PREFIX } from '~/utils/globals';

const _log = debug('nc:cache');

export default class RedisMockCacheMgr extends CacheMgr {
  constructor() {
    super();
    this.client = new Redis();
    // flush the existing db with selected key (Default: 0)
    this.client.flushdb();

    // TODO(cache): fetch orgs once it's implemented
    const orgs = 'noco';
    this.prefix = `${CACHE_PREFIX}:${orgs}`;
    this.context = 'RedisMockCacheMgr';
  }
}
