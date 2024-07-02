import { Logger } from '@nestjs/common';
import Redis from 'ioredis';

export class PubSubRedis {
  static initialized = false;

  static available = process.env.NC_REDIS_JOB_URL ? true : false;

  protected static logger = new Logger(PubSubRedis.name);

  public static redisClient: Redis;
  public static redisSubscriber: Redis;

  public static async init() {
    if (!PubSubRedis.available) {
      return;
    }

    PubSubRedis.redisClient = new Redis(process.env.NC_REDIS_JOB_URL);
    PubSubRedis.redisSubscriber = new Redis(process.env.NC_REDIS_JOB_URL);

    PubSubRedis.initialized = true;
  }

  static async publish(channel: string, message: string | Record<string, any>) {
    if (!PubSubRedis.initialized) {
      if (!PubSubRedis.available) {
        return;
      }

      await PubSubRedis.init();
    }
    try {
      if (typeof message === 'string') {
        await PubSubRedis.redisClient.publish(channel, message);
      } else {
        await PubSubRedis.redisClient.publish(channel, JSON.stringify(message));
      }
    } catch (e) {
      PubSubRedis.logger.error(e);
    }
  }

  /**
   *
   * @param channel
   * @param callback
   * @returns Returns a callback to unsubscribe
   */
  static async subscribe(
    channel: string,
    callback: (message: any) => Promise<void>,
  ): Promise<(keepRedisChannel?: boolean) => Promise<void>> {
    if (!PubSubRedis.initialized) {
      if (!PubSubRedis.available) {
        return;
      }
      await PubSubRedis.init();
    }

    await PubSubRedis.redisSubscriber.subscribe(channel);

    const onMessage = async (messageChannel, message) => {
      if (channel !== messageChannel) {
        return;
      }

      try {
        message = JSON.parse(message);
      } catch (e) {}
      await callback(message);
    };

    PubSubRedis.redisSubscriber.on('message', onMessage);
    return async (keepRedisChannel = false) => {
      // keepRedisChannel is used to keep the channel open for other subscribers
      if (!keepRedisChannel)
        await PubSubRedis.redisSubscriber.unsubscribe(channel);
      PubSubRedis.redisSubscriber.off('message', onMessage);
    };
  }
}
