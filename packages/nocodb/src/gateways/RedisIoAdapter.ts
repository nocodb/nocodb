import { IoAdapter } from '@nestjs/platform-socket.io';
import { Redis } from 'ioredis';
import RedisMock from 'ioredis-mock';
import type { createAdapter } from '@socket.io/redis-adapter';
import type { ServerOptions } from 'socket.io';
import { getRedisURL } from '~/helpers/redisHelpers';

export class RedisIoAdapter extends IoAdapter {
  private adapterConstructor: ReturnType<typeof createAdapter>;

  async connectToRedis(): Promise<void> {
    let pubClient;

    const redisUrl = getRedisURL();

    if (redisUrl) {
      pubClient = new Redis(redisUrl);
    } else {
      pubClient = new RedisMock();
    }

    const subClient = pubClient.duplicate();

    // notepack (the adapter's encoder) reads this on load. Each cached key pins an 8 KB
    // pool slab, and broadcast keys are mostly ids, so its 1024 default holds ~8 MB.
    process.env.NOTEPACK_ENCODE_CACHE_MAX_SIZE ??= '128';
    const { createAdapter } = await import('@socket.io/redis-adapter');

    this.adapterConstructor = createAdapter(pubClient, subClient);
  }

  createIOServer(port: number, options?: ServerOptions): any {
    const server = super.createIOServer(port, options);
    server.adapter(this.adapterConstructor);
    return server;
  }
}
