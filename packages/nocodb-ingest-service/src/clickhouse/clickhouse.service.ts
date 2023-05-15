import { Injectable, Logger } from '@nestjs/common';
import { ClickHouse } from 'clickhouse';
import type { OnModuleInit } from '@nestjs/common';
import NcConfigFactory from '../helpers/NcConfigFactory';

@Injectable()
export class ClickhouseService implements OnModuleInit {
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
      host: `${client ?? 'http'}://${connection.host ?? 'localhost'}`,
      port: connection.port ?? 8123,
      username: connection.user,
      password: connection.password,
      database: connection.database ?? 'nc',
    };
    try {
      this.client = new ClickHouse(this.config);
    } catch (e) {
      this.logger.error(e);
      process.exit(1);
    }
  }
}
