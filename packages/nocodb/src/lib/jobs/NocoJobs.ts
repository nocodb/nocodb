import { getRedisURI } from '../../database/redis';
import EmitteryJobsMgr from './EmitteryJobsMgr';
import RedisJobsMgr from './RedisJobsMgr';
import type JobsMgr from './JobsMgr';

export default class NocoJobs {
  private static client: JobsMgr;

  private static init() {
    const redisURI = getRedisURI();
    if (redisURI) {
      this.client = new RedisJobsMgr(redisURI);
    } else {
      this.client = new EmitteryJobsMgr();
    }
  }

  public static get jobsMgr(): JobsMgr {
    if (!this.client) this.init();
    return this.client;
  }
}
