import Redlock from 'redlock';
import Client from 'ioredis';
import type { Lock, Settings } from 'redlock';

export class RedlockWrapper {
  private client: Client;
  private redlock: Redlock;

  constructor(options: Settings) {
    if (process.env['NC_THROTTLER_REDIS'] || process.env.NC_REDIS_URL) {
      this.client = new Client(
        process.env['NC_THROTTLER_REDIS'] || process.env.NC_REDIS_URL,
      );
      this.redlock = new Redlock([this.client], options);
    }
  }

  public async acquireLock(
    resources: string[],
    ttl: number,
  ): Promise<Lock | undefined> {
    if (!this.redlock) return undefined;

    try {
      const lock = await this.redlock.acquire(resources, ttl);
      return lock;
    } catch (error) {
      console.error('Error acquiring lock:', error);
      return undefined;
    }
  }

  public async releaseLock(lock: Lock): Promise<void> {
    if (!lock) return;

    try {
      await lock.release();
    } catch (error) {
      console.error('Error releasing lock:', error);
    }
  }

  public async executeWithLock(
    resources: string[],
    ttl: number,
    callback: () => Promise<void>,
  ): Promise<void> {
    let lock: Lock | undefined;
    try {
      lock = await this.acquireLock(resources, ttl);

      await callback();
    } finally {
      if (lock) {
        await this.releaseLock(lock);
      }
    }
  }
}

export default RedlockWrapper;
