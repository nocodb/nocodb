import debug from 'debug';
import Redis from 'ioredis';
import CacheMgr from './CacheMgr';

const _log = debug('nc:cache');

export default class RedisCacheMgr extends CacheMgr {
  constructor(config: any) {
    super();
    this.client = new Redis(config);

    // avoid flushing db in worker container
    if (
      process.env.NC_WORKER_CONTAINER !== 'true' &&
      (process.env.NC_FLUSH_CACHE === 'true' || process.env.NC_CLOUD !== 'true')
    ) {
      // flush the existing db with selected key (Default: 0)
      this.client.flushdb();
    }

    // TODO(cache): fetch orgs once it's implemented
    const orgs = 'noco';
    this.prefix = `nc:${orgs}`;
    this.context = 'RedisCacheMgr';
  }
}
