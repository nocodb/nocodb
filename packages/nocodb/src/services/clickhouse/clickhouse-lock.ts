import { ClickHouse } from 'clickhouse';

class ClickhouseLock {
  private client: ClickHouse;
  private database: string;

  constructor(opts: object) {
    this.client = new ClickHouse(opts);
    this.database = opts['database'];
  }
  private async createDatabase(): Promise<void> {
    const query = `CREATE DATABASE IF NOT EXISTS ${this.database}`;
    await this.client.query(query);
  }

  private async createLockTable(): Promise<void> {
    const query = `
      CREATE TABLE IF NOT EXISTS migrations_lock (
        is_locked UInt8 DEFAULT 0
      )
    `;
    await this.client.query(query);
  }

  private async updateLockStatus(isLocked: number): Promise<void> {
    await this.client.query(
      `ALTER TABLE migrations_lock UPDATE is_locked = ${isLocked} WHERE is_locked = ${
        1 - isLocked
      }`,
    );
  }

  public async acquireLock(): Promise<void> {
    await this.createDatabase();
    await this.createLockTable();
    await this.updateLockStatus(1);
  }

  public async releaseLock(): Promise<void> {
    await this.updateLockStatus(0);
  }

  public async isLockAcquired(): Promise<boolean> {
    const result = await this.client.query(
      'SELECT is_locked FROM migrations_lock',
    );
    return result[0].is_locked === 1;
  }

  public async executeWithLock(
    callback: () => Promise<void>,
    maxWaitTime: number,
    pollInterval = 1000
  ): Promise<void> {
    const startTime = Date.now();

    while (await this.isLockAcquired()) {
      if (Date.now() - startTime > maxWaitTime) {
        throw new Error('Lock acquisition timeout exceeded.');
      }
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }

    await this.acquireLock();

    try {
      await callback();
    } finally {
      await this.releaseLock();
    }
  }
}

export default ClickhouseLock;
