import path from 'path';
import { Injectable, Logger } from '@nestjs/common';
import { ClickHouse } from 'clickhouse';
import { migration } from 'clickhouse-migrations/lib/migrate';
import ClickhouseLock from './clickhouse-lock';
import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { metaUrlToDbConfig } from '~/utils/nc-config';

@Injectable()
export class ClickhouseService implements OnModuleInit, OnModuleDestroy {
  private client: ClickHouse;
  private config: {
    username?: string;
    password?: string;
    host?: string;
    port?: number;
    database?: string;
  };
  private logger = new Logger(ClickhouseService.name);

  async execute(query: string, isInsert = false): Promise<any> {
    if (!this.client) return;

    return isInsert
      ? this.client.insert(query).toPromise()
      : this.client.query(query).toPromise();
  }

  onModuleDestroy(): any {}

  async onModuleInit(): Promise<any> {
    if (!process.env.NC_CLICKHOUSE) {
      return;
    }

    const { connection, client } = await metaUrlToDbConfig(
      process.env.NC_CLICKHOUSE,
    );

    this.config = {
      host: `${client}://${connection.host}` ?? 'http://localhost',
      port: connection.port ?? 8123,
      username: connection.user,
      password: connection.password,
      database: connection.database ?? 'nc',
    };

    try {
      const clickhouseLock = new ClickhouseLock(this.config);

      await clickhouseLock.executeWithLock(
        async () => {
          await migration(
            path.join(__dirname, 'migrations'),
            `${this.config.host}:${this.config.port}`,
            this.config.username,
            this.config.password,
            this.config.database,
          );
        },
        120000,
        2000,
      );

      // const redlock = new RedlockWrapper({
      //   retryCount: 10,
      //   retryDelay: 1000,
      //   retryJitter: 200,
      //   driftFactor: 0.01,
      //   automaticExtensionThreshold: 500, // time in ms
      // });
      //
      // await redlock.executeWithLock(
      //   ['nc-clickhouse-migration'],
      //   10000,
      //   async () => {
      //     await migration(
      //       path.join(__dirname, 'migrations'),
      //       `${this.config.host}:${this.config.port}`,
      //       this.config.username,
      //       this.config.password,
      //       this.config.database,
      //     );
      //   },
      // );
    } catch (e) {
      this.logger.error('Check Clickhouse configuration');
      throw e;
    }
    this.client = new ClickHouse(this.config);
  }
}
