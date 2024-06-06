import { Logger } from '@nestjs/common';
import Redis from 'ioredis';

export class PubSubRedis {
  static initialized = false;

  static available = process.env.NC_REDIS_JOB_URL ? true : false;

  protected static logger = new Logger(PubSubRedis.name);

  static redisClient: Redis;
  private static redisSubscriber: Redis;
  private static unsubscribeCallbacks: { [key: string]: () => Promise<void> } =
    {};
  private static callbacks: Record<string, (...args) => Promise<void>> = {};

  public static async init() {
    if (!PubSubRedis.available) {
      return;
    }

    PubSubRedis.redisClient = new Redis(process.env.NC_REDIS_JOB_URL);
    PubSubRedis.redisSubscriber = new Redis(process.env.NC_REDIS_JOB_URL);

    PubSubRedis.redisSubscriber.on('message', async (channel, message) => {
      const [command, ...args] = message.split(':');
      const callback = PubSubRedis.callbacks[command];
      if (callback) await callback(...args);
    });

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

  static async unsubscribe(channel: string) {
    if (!PubSubRedis.initialized) {
      if (!PubSubRedis.available) {
        return;
      }

      await PubSubRedis.init();
    }

    if (PubSubRedis.unsubscribeCallbacks[channel]) {
      await PubSubRedis.unsubscribeCallbacks[channel]();
      delete PubSubRedis.unsubscribeCallbacks[channel];
    }
  }

  static async subscribe(
    channel: string,
    callback: (message: any) => Promise<void>,
  ) {
    if (!PubSubRedis.initialized) {
      if (!PubSubRedis.available) {
        return;
      }
      await PubSubRedis.init();
    }

    await PubSubRedis.redisSubscriber.subscribe(channel);

    const onMessage = async (_channel, message) => {
      try {
        message = JSON.parse(message);
      } catch (e) {}
      await callback(message);
    };

    PubSubRedis.redisSubscriber.on('message', onMessage);
    PubSubRedis.unsubscribeCallbacks[channel] = async () => {
      await PubSubRedis.redisSubscriber.unsubscribe(channel);
      PubSubRedis.redisSubscriber.off('message', onMessage);
    };
  }
}
