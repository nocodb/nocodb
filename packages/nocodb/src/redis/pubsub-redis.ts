import { Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { getRedisURL, NC_REDIS_TYPE } from '~/helpers/redisHelpers';

export class PubSubRedis {
  static initialized = false;

  static available = getRedisURL(NC_REDIS_TYPE.JOB) ? true : false;

  protected static logger = new Logger(PubSubRedis.name);

  public static redisClient: Redis;
  public static redisSubscriber: Redis;

  /**
   * channel -> handler set. One shared 'message' listener (ensureMessageListener)
   * demuxes by channel, instead of one listener per subscribe() (O(N) dispatch +
   * MaxListenersExceededWarning past ~10 channels).
   */
  private static handlers = new Map<string, Set<(message: any) => void>>();
  private static messageListenerBound = false;

  public static async init() {
    if (!PubSubRedis.available) {
      return;
    }

    PubSubRedis.redisClient = new Redis(getRedisURL(NC_REDIS_TYPE.JOB));
    PubSubRedis.redisSubscriber = new Redis(getRedisURL(NC_REDIS_TYPE.JOB));

    PubSubRedis.initialized = true;
  }

  private static ensureMessageListener() {
    if (PubSubRedis.messageListenerBound) return;
    PubSubRedis.messageListenerBound = true;
    PubSubRedis.redisSubscriber.on('message', (messageChannel, message) => {
      const set = PubSubRedis.handlers.get(messageChannel);
      if (!set) return;
      let parsed: any = message;
      try {
        parsed = JSON.parse(message);
      } catch (e) {}
      for (const handler of set) {
        try {
          handler(parsed);
        } catch (e) {
          PubSubRedis.logger.error(
            `PubSubRedis: handler threw on channel ${messageChannel}`,
            (e as Error)?.stack,
          );
        }
      }
    });
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
   * @returns Returns a callback to unsubscribe this handler. The underlying
   * Redis channel is only unsubscribed when its last local handler is removed
   * (ref-counted), so co-subscribers on the same channel are unaffected.
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

    PubSubRedis.ensureMessageListener();

    // Hoisted fn declarations so wrapped <-> unsubscribe can reference each other.
    function wrapped(message: any) {
      void callback(message, unsubscribe);
    }

    async function unsubscribe(keepRedisChannel = false) {
      // keepRedisChannel is used to keep the channel open for other subscribers
      const set = PubSubRedis.handlers.get(channel);
      if (!set) return;
      set.delete(wrapped);
      if (set.size === 0) {
        PubSubRedis.handlers.delete(channel);
        if (!keepRedisChannel) {
          await PubSubRedis.redisSubscriber.unsubscribe(channel);
        }
      }
    }

    let set = PubSubRedis.handlers.get(channel);
    if (!set) {
      set = new Set();
      PubSubRedis.handlers.set(channel, set);
      await PubSubRedis.redisSubscriber.subscribe(channel);
    }
    set.add(wrapped);

    return unsubscribe;
  }
}
