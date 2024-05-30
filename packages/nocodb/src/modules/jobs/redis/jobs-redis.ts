import { Logger } from '@nestjs/common';
import Redis from 'ioredis';
import type { InstanceCommands } from '~/interface/Jobs';
import { InstanceTypes } from '~/interface/Jobs';

export class JobsRedis {
  private static initialized = false;

  public static available = process.env.NC_REDIS_JOB_URL ? true : false;

  protected static logger = new Logger(JobsRedis.name);

  private static redisClient: Redis;
  private static redisSubscriber: Redis;
  private static unsubscribeCallbacks: { [key: string]: () => Promise<void> } =
    {};

  public static primaryCallbacks: {
    [key: string]: (...args) => Promise<void>;
  } = {};
  public static workerCallbacks: { [key: string]: (...args) => Promise<void> } =
    {};

  static async init() {
    if (this.initialized) {
      return;
    }

    if (!JobsRedis.available) {
      return;
    }

    this.initialized = true;

    this.redisClient = new Redis(process.env.NC_REDIS_JOB_URL);
    this.redisSubscriber = new Redis(process.env.NC_REDIS_JOB_URL);

    if (process.env.NC_WORKER_CONTAINER === 'true') {
      await this.redisSubscriber.subscribe(InstanceTypes.WORKER);
    } else {
      await this.redisSubscriber.subscribe(InstanceTypes.PRIMARY);
    }

    const onMessage = async (channel, message) => {
      const args = message.split(':');
      const command = args.shift();
      if (channel === InstanceTypes.WORKER) {
        this.workerCallbacks[command] &&
          (await this.workerCallbacks[command](...args));
      } else if (channel === InstanceTypes.PRIMARY) {
        this.primaryCallbacks[command] &&
          (await this.primaryCallbacks[command](...args));
      }
    };

    this.redisSubscriber.on('message', onMessage);
  }

  static async publish(channel: string, message: string | any) {
    if (!this.initialized) {
      if (!JobsRedis.available) {
        return;
      }

      await this.init();
    }

    if (typeof message === 'string') {
      await this.redisClient.publish(channel, message);
    } else {
      try {
        await this.redisClient.publish(channel, JSON.stringify(message));
      } catch (e) {
        this.logger.error(e);
      }
    }
  }

  static async subscribe(
    channel: string,
    callback: (message: any) => Promise<void>,
  ) {
    if (!this.initialized) {
      if (!JobsRedis.available) {
        return;
      }

      await this.init();
    }

    await this.redisSubscriber.subscribe(channel);

    const onMessage = async (_channel, message) => {
      try {
        message = JSON.parse(message);
      } catch (e) {}
      await callback(message);
    };

    this.redisSubscriber.on('message', onMessage);
    this.unsubscribeCallbacks[channel] = async () => {
      await this.redisSubscriber.unsubscribe(channel);
      this.redisSubscriber.off('message', onMessage);
    };
  }

  static async unsubscribe(channel: string) {
    if (!this.initialized) {
      if (!JobsRedis.available) {
        return;
      }

      await this.init();
    }

    if (this.unsubscribeCallbacks[channel]) {
      await this.unsubscribeCallbacks[channel]();
      delete this.unsubscribeCallbacks[channel];
    }
  }

  static async workerCount(): Promise<number> {
    if (!this.initialized) {
      if (!JobsRedis.available) {
        return;
      }

      await this.init();
    }

    return new Promise((resolve) => {
      this.redisClient.publish(
        InstanceTypes.WORKER,
        'count',
        (error, numberOfSubscribers) => {
          if (error) {
            this.logger.warn(error);
            resolve(0);
          } else {
            resolve(numberOfSubscribers);
          }
        },
      );
    });
  }

  static async emitWorkerCommand(command: InstanceCommands, ...args: any[]) {
    const data = `${command}${args.length ? `:${args.join(':')}` : ''}`;
    await JobsRedis.publish(InstanceTypes.WORKER, data);
  }

  static async emitPrimaryCommand(command: InstanceCommands, ...args: any[]) {
    const data = `${command}${args.length ? `:${args.join(':')}` : ''}`;
    await JobsRedis.publish(InstanceTypes.PRIMARY, data);
  }
}
