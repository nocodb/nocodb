import debug from 'debug';
import Redis from 'ioredis';
import CacheMgr from './CacheMgr';
import { CACHE_PREFIX } from '~/utils/globals';

const _log = debug('nc:cache');

export default class RedisCacheMgr extends CacheMgr {
  constructor(config: any) {
    super();
    this.client = new Redis(config);

    // TODO(cache): fetch orgs once it's implemented
    const orgs = 'noco';
    this.prefix = `${CACHE_PREFIX}:${orgs}`;
    this.context = 'RedisCacheMgr';

    // avoid flushing db in worker container
    if (
      process.env.NC_WORKER_CONTAINER !== 'true' &&
      (process.env.NC_FLUSH_CACHE === 'true' ||
        process.env.NC_CLOUD !== 'true') &&
      process.env.NC_KEEP_CACHE !== 'true'
    ) {
      // Selective, not FLUSHDB — the collab crash buffer has to outlive a restart.
      this.ready = this.flushDisposable();
    }
  }
}
