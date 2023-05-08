import { Injectable } from '@nestjs/common';
import Client from 'ioredis';
import Redlock from 'redlock';
import { ConfigService } from '@nestjs/config';
import { ClickhouseService } from './clickhouse/clickhouse.service';
import type { OnModuleInit } from '@nestjs/common';
import type { AppConfig } from '../interface/config';

@Injectable()
export class ThrottlerExpiryListenerService implements OnModuleInit {
  private client;
  private subscriber;
  private redlock: Redlock;

  constructor(
    private readonly clickHouseService: ClickhouseService,
    private readonly configService: ConfigService<AppConfig>,
  ) {
    this.client = new Client(process.env['NC_THROTTLER_REDIS']);
    this.subscriber = new Client(process.env['NC_THROTTLER_REDIS']);

    this.redlock = new Redlock([this.client], {
      // The expected clock drift; for more details see:
      // http://redis.io/topics/distlock
      driftFactor: 0.01, // multiplied by lock ttl to determine drift time

      // The max number of times Redlock will attempt to lock a resource
      // before erroring.
      retryCount: 10,

      // the time in ms between attempts
      retryDelay: 200, // time in ms

      // the max time in ms randomly added to retries
      // to improve performance under high contention
      // see https://www.awsarchitectureblog.com/2015/03/backoff.html
      retryJitter: 200, // time in ms

      // The minimum remaining time on a lock before an extension is automatically
      // attempted with the `using` API.
      automaticExtensionThreshold: 500, // time in ms
    });
  }

  onModuleInit() {
    // Key pattern to watch for expiration
    const keyPattern = 'throttler:';

    // Listen for the client to be ready
    this.client.on('ready', async () => {
      // Enable keyspace notifications for expired events
      try {
        await this.client.config('SET', 'notify-keyspace-events', 'Ex');
      } catch (err) {
        console.error('Failed to enable keyspace notifications:', err);
      }

      // Subscribe to expired events
      this.subscriber.psubscribe(
        `__keyevent@${process.env['NC_THROTTLER_REDIS']
          .split('/')
          .pop()}__:expired`,
      );

      // Listen for expired events
      this.subscriber.on('pmessage', async (pattern, channel, expiredKey) => {
        const count = await this.client.get(expiredKey + '_shadow');

        if (expiredKey.startsWith(keyPattern)) {
          console.log(
            `Key with pattern "${keyPattern}" has expired: ${expiredKey}`,
          );

          // Acquire a lock.
          const lock = await this.redlock.acquire(['throttler'], 5000);
          try {
            // Do something...
            await this.logDataToClickHouse(expiredKey, count);
          } finally {
            // Release the lock.
            await lock.release();
          }
        }
      });
    });
  }

  private async logDataToClickHouse(expiredKey, count) {
    const config = this.configService.get<AppConfig['throttler']>('throttler');
    const result: number | string = await this.client.call(
      'EVAL',
      `
      local lasUpdated = tonumber(redis.call("GET", KEYS[1]))
      local sync = 0
      if not lasUpdated or lasUpdated == 0 or lasUpdated <= tonumber(ARGV[2])
        then
          redis.call("SET", KEYS[1], ARGV[1])
          sync = 1
        end
      return sync 
    `
        .replace(/^\s+/gm, '')
        .trim(),
      1,
      `status|${expiredKey}`,
      Date.now(),
      Date.now() - config.ttl * 1000,
    );

    if (+result) {
      const [_, workspaceId, token] = expiredKey.match(/throttler:(.+)\|(.+)/);

      this.clickHouseService.execute(`
        INSERT INTO api_count (id,fk_workspace_id, api_token,count, created_at, ttl, max_apis)
        VALUES (generateUUIDv4(), '${workspaceId}', '${token}', ${count}, now(), ${config.ttl}, ${config.max_apis})
      `);
    }
  }
}
