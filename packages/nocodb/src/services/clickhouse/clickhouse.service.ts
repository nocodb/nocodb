import { Injectable } from '@nestjs/common';
import { ClickHouse } from 'clickhouse';
import NcConfigFactory from '../../utils/NcConfigFactory';
import * as nc_001_notification from './migrations/nc_001_notification';
import * as nc_002_page_history from './migrations/nc_002_page_history';
import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common';

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

    const { connection, client } = await NcConfigFactory.metaUrlToDbConfig(
      process.env.NC_CLICKHOUSE,
    );

    this.config = {
      host: `${client}://${connection.host}` ?? 'http://localhost',
      port: connection.port ?? 8123,
      username: connection.user,
      password: connection.password,
      database: connection.database ?? 'nc',
    };

    // Create a new ClickHouse client instance
    const clickhouse = new ClickHouse({ ...this.config, database: undefined });
    for (const { up } of [nc_001_notification, nc_002_page_history]) {
      await up(clickhouse, this.config);
    }

    this.client = new ClickHouse(this.config);
  }
}
