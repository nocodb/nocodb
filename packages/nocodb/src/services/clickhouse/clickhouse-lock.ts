import { ClickHouse } from 'clickhouse';

class ClickhouseLock {
  private client: ClickHouse;
  private database: string;
  private config: any;
  private table = 'migrations_lock';

  constructor(config: object) {
    this.config = config;
    this.client = new ClickHouse(config);
  }
  private async createDatabase(): Promise<void> {
    const client = new ClickHouse({
      ...this.config,
      database: undefined,
    });
    const query = `CREATE DATABASE IF NOT EXISTS ${this.config.database}`;
    await client.query(query).toPromise();
  }

  private async createLockTable(): Promise<void> {
    const query = `
      CREATE TABLE IF NOT EXISTS migrations_lock (
        is_locked UInt8 DEFAULT 0
      ) ENGINE = MergeTree()
    `;
    await this.client.query(query).toPromise();
  }

  private async updateLockStatus(isLocked: number): Promise<void> {
    await this.client
      .query(`DELETE FROM ${this.database}.${this.table} WHERE TRUE`)
      .toPromise();
  }

  public async acquireLock(): Promise<void> {
    await this.createDatabase();
    await this.createLockTable();

    const isLockAcquired = await this.isLockAcquired();
    if (!isLockAcquired) {
      await this.client
        .query(
          `INSERT INTO ${this.database}.${this.table} (is_locked) VALUES (1)`,
        )
        .toPromise();
    } else {
      throw new Error('Lock is already acquired by another process.');
    }
  }

  public async releaseLock(): Promise<void> {
    await this.updateLockStatus(0);
  }

  public async isLockAcquired(): Promise<boolean> {
    const query = `SELECT count() as count FROM ${this.database}.${this.table}`;
    const result: any = await this.client.query(query).toPromise();
    const rowCount = result?.[0]?.count;

    if (rowCount === 0) {
      // No entry in the lock table, lock is not acquired
      return false;
    }

    const lockResult: any = await this.client
      .query(`SELECT is_locked FROM ${this.database}.${this.table}`)
      .toPromise();
    return lockResult?.[0]?.is_locked === 1;
  }

  public async executeWithLock(
    callback: () => Promise<void>,
    maxWaitTime: number,
    pollInterval = 1000,
  ): Promise<void> {
    await this.createDatabase();
    await this.createLockTable();

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
