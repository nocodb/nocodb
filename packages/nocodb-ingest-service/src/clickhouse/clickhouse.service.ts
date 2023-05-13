import { Injectable, Logger } from '@nestjs/common';
import { ClickHouse } from 'clickhouse';
import * as nc_001_notification from './migrations/nc_001_notification';
import * as nc_002_page from './migrations/nc_002_page';
import * as nc_003_api_count from './migrations/nc_003_api_count';
import * as nc_004_api_exec from './migrations/nc_004_api_calls';
import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import NcConfigFactory from '../helpers/NcConfigFactory';

const knownQueryParams = [
  {
    parameter: 'database',
    aliases: ['d', 'db'],
  },
  {
    parameter: 'password',
    aliases: ['p'],
  },
  {
    parameter: 'user',
    aliases: ['u'],
  },
  {
    parameter: 'title',
    aliases: ['t'],
  },
  {
    parameter: 'keyFilePath',
    aliases: [],
  },
  {
    parameter: 'certFilePath',
    aliases: [],
  },
  {
    parameter: 'caFilePath',
    aliases: [],
  },
  {
    parameter: 'ssl',
    aliases: [],
  },
  {
    parameter: 'options',
    aliases: ['opt', 'opts'],
  },
];

@Injectable()
export class ClickhouseService implements OnModuleInit, OnModuleDestroy {
  private client: ClickHouse;
  private logger: Logger = new Logger(ClickhouseService.name);

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
      this.logger.error(
        'NC_CLICKHOUSE environment variable is not set. Please set it to a valid ClickHouse connection string.',
      );
      process.exit(1);
    }

    const { connection, client } = await NcConfigFactory.metaUrlToDbConfig(
      process.env.NC_CLICKHOUSE,
    );

    this.config = {
      host:
        `${client ?? 'http'}://${connection.host ?? 'localhost'}` ??
        'http://localhost',
      port: connection.port ?? 8123,
      username: connection.user,
      password: connection.password,
      database: connection.database ?? 'nc',
    };
    try {
      // Create a new ClickHouse client instance
      const clickhouse = new ClickHouse({
        ...this.config,
        database: undefined,
      });
      for (const { up } of [
        nc_001_notification,
        nc_002_page,
        nc_003_api_count,
        nc_004_api_exec,
      ]) {
        await up(clickhouse, this.config);
      }

      this.client = new ClickHouse(this.config);
    } catch (e) {
      this.logger.error(e);
      process.exit(1);
    }
  }
}
