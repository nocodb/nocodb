import { Injectable } from '@nestjs/common';
import { ClickHouse } from 'clickhouse';
import * as nc_001_notification from './migrations/nc_001_notification';
import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common';

@Injectable()
export class ClickhouseService implements OnModuleInit, OnModuleDestroy {
  private readonly client: ClickHouse;

  constructor() {
    this.client = new ClickHouse({
      host: 'localhost',
      port: 8123,
      // username: 'your-username',
      // password: 'your-password',
      database: 'database',
    });
  }

  async execute(query: string, isInsert = false  ): Promise<any> {
    return isInsert ? this.client.insert(query).toPromise() : this.client.query(query).toPromise();
  }

  onModuleDestroy(): any {}

  async onModuleInit(): Promise<any> {

    // Create a new ClickHouse client instance
    const clickhouse = new ClickHouse({
      host: 'localhost',
      port: 8123,
      // username: 'my_username',
      // password: 'my_password'
    });
    for (const { up } of [nc_001_notification]) {
      await up(clickhouse);
    }

  }
}
