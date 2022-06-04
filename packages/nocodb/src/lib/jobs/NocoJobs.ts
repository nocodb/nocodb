import JobsMgr from './JobsMgr';
import EmitteryJobsMgr from './EmitteryJobsMgr';
import RedisJobsMgr from './RedisJobsMgr';

export default class NocoJobs {
  private static client: JobsMgr;

  private static init() {
    if (process.env.NC_REDIS_URL) {
      this.client = new RedisJobsMgr(process.env.NC_REDIS_URL);
    } else {
      this.client = new EmitteryJobsMgr();
    }
  }

  public static get jobsMgr(): JobsMgr {
    if (!this.client) this.init();
    return this.client;
  }
}
