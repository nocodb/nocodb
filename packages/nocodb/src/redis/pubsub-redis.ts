import { Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { getRedisURL, NC_REDIS_TYPE } from '~/helpers/redisHelpers';

export class PubSubRedis {
  static initialized = false;

  static available = getRedisURL(NC_REDIS_TYPE.JOB) ? true : false;

  protected static logger = new Logger(PubSubRedis.name);

  public static redisClient: Redis;
  public static redisSubscriber: Redis;

  public static async init() {
    if (!PubSubRedis.available) {
      return;
    }

    PubSubRedis.redisClient = new Redis(getRedisURL(NC_REDIS_TYPE.JOB));
    PubSubRedis.redisSubscriber = new Redis(getRedisURL(NC_REDIS_TYPE.JOB));

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
  static async subscribe<T = any>(
    channel: string,
    callback: (
      message: T,
      unsubscribe?: (keepRedisChannel?: boolean) => Promise<void>,
    ) => Promise<void>,
  ): Promise<(keepRedisChannel?: boolean) => Promise<void>> {
    if (!PubSubRedis.initialized) {
      if (!PubSubRedis.available) {
        return;
      }
      await PubSubRedis.init();
    }

    await PubSubRedis.redisSubscriber.subscribe(channel);

    const unsubscribe = async (keepRedisChannel = false) => {
      // keepRedisChannel is used to keep the channel open for other subscribers
      if (!keepRedisChannel)
        await PubSubRedis.redisSubscriber.unsubscribe(channel);
      PubSubRedis.redisSubscriber.off('message', onMessage);
    };

    const onMessage = async (messageChannel, message) => {
      if (channel !== messageChannel) {
        return;
      }

      try {
        message = JSON.parse(message);
      } catch (e) {}
      await callback(message, unsubscribe);
    };

    PubSubRedis.redisSubscriber.on('message', onMessage);
    return unsubscribe;
  }
}
