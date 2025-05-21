import { Injectable } from '@nestjs/common';
import NocoCache from '~/cache/NocoCache';

@Injectable()
export class CachesService {
  async cacheGet() {
    return await NocoCache.export();
  }

  async cacheDelete() {
    await NocoCache.destroy();
    return true;
  }
}
