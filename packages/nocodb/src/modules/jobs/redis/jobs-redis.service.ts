import { Injectable } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class JobsRedisService {
  private redisClient: Redis;
  private redisSubscriber: Redis;
  private unsubscribeCallbacks: { [key: string]: () => void } = {};

  public workerCallbacks: { [key: string]: () => void } = {};
  public instanceCallbacks: { [key: string]: () => void } = {};

  constructor() {
    this.redisClient = new Redis(process.env.NC_REDIS_JOB_URL);
    this.redisSubscriber = new Redis(process.env.NC_REDIS_JOB_URL);

    if (process.env.NC_WORKER_CONTAINER === 'true') {
      this.redisSubscriber.subscribe('workers');
    } else {
      this.redisSubscriber.subscribe('instances');
    }

    const onMessage = (channel, message) => {
      console.log('onMessage', channel, message);
      if (channel === 'workers') {
        this.workerCallbacks[message] && this.workerCallbacks[message]();
      } else if (channel === 'instances') {
        this.instanceCallbacks[message] && this.instanceCallbacks[message]();
      }
    };

    this.redisSubscriber.on('message', onMessage);
  }

  publish(channel: string, message: string | any) {
    if (typeof message === 'string') {
      this.redisClient.publish(channel, message);
    } else {
      try {
        this.redisClient.publish(channel, JSON.stringify(message));
      } catch (e) {
        console.error(e);
      }
    }
  }

  subscribe(channel: string, callback: (message: any) => void) {
    this.redisSubscriber.subscribe(channel);

    const onMessage = (_channel, message) => {
      try {
        message = JSON.parse(message);
      } catch (e) {}
      callback(message);
    };

    this.redisSubscriber.on('message', onMessage);
    this.unsubscribeCallbacks[channel] = () => {
      this.redisSubscriber.unsubscribe(channel);
      this.redisSubscriber.off('message', onMessage);
    };
  }

  unsubscribe(channel: string) {
    if (this.unsubscribeCallbacks[channel]) {
      this.unsubscribeCallbacks[channel]();
      delete this.unsubscribeCallbacks[channel];
    }
  }

  workerCount(): Promise<number> {
    return new Promise((resolve, reject) => {
      this.redisClient.publish(
        'workers',
        'count',
        (error, numberOfSubscribers) => {
          if (error) {
            reject(0);
          } else {
            resolve(numberOfSubscribers);
          }
        },
      );
    });
  }
}
