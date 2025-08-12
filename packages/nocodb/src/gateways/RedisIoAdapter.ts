import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { Redis } from 'ioredis';
import RedisMock from 'ioredis-mock';
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

    this.adapterConstructor = createAdapter(pubClient, subClient);
  }

  createIOServer(port: number, options?: ServerOptions): any {
    const server = super.createIOServer(port, options);
    server.adapter(this.adapterConstructor);
    return server;
  }
}
