import { Logger } from '@nestjs/common';
import type { InstanceCommands } from '~/interface/Jobs';
import { PubSubRedis } from '~/redis/pubsub-redis';
import { InstanceTypes } from '~/interface/Jobs';

export class JobsRedis {
  protected static logger = new Logger(JobsRedis.name);

  public static available = PubSubRedis.available;

  public static primaryCallbacks: {
    [key: string]: (...args) => Promise<void>;
  } = {};
  public static workerCallbacks: { [key: string]: (...args) => Promise<void> } =
    {};

  static async initJobs() {
    if (!PubSubRedis.initialized) {
      if (!PubSubRedis.available) {
        return;
      }

      await PubSubRedis.init();
    }

    const onMessage = async (channel, message) => {
      try {
        if (!message) {
          return;
        }
        const args = message.split(':');
        const command = args.shift();

        if (channel === InstanceTypes.WORKER) {
          this.workerCallbacks[command] &&
            (await this.workerCallbacks[command](...args));
        } else if (channel === InstanceTypes.PRIMARY) {
          this.primaryCallbacks[command] &&
            (await this.primaryCallbacks[command](...args));
        }
      } catch (error) {
        this.logger.error({
          message: `Error processing redis pub-sub message ${message}`,
          error: {
            message: error?.message,
            stack: error?.stack,
          },
        });
      }
    };

    if (process.env.NC_WORKER_CONTAINER === 'true') {
      await PubSubRedis.subscribe(InstanceTypes.WORKER, async (message) => {
        await onMessage(InstanceTypes.WORKER, message);
      });
    } else {
      await PubSubRedis.subscribe(InstanceTypes.PRIMARY, async (message) => {
        await onMessage(InstanceTypes.PRIMARY, message);
      });
    }
  }

  static async workerCount(): Promise<number> {
    if (!PubSubRedis.initialized) {
      if (!PubSubRedis.available) {
        return;
      }

      await PubSubRedis.init();
      await this.initJobs();
    }

    return new Promise((resolve) => {
      PubSubRedis.redisClient.publish(
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
    await PubSubRedis.publish(InstanceTypes.WORKER, data);
  }

  static async emitPrimaryCommand(command: InstanceCommands, ...args: any[]) {
    const data = `${command}${args.length ? `:${args.join(':')}` : ''}`;
    await PubSubRedis.publish(InstanceTypes.PRIMARY, data);
  }

  static publish = PubSubRedis.publish;
  static subscribe = PubSubRedis.subscribe;
}
