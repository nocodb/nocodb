import {
  Controller,
  Get,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import {
  Client,
  ClientKafka,
  MessagePattern,
  Payload,
  Transport,
} from '@nestjs/microservices';
import { ClickhouseService } from './clickhouse/clickhouse.service';

@Controller()
export class AppController {
  private logger = new Logger(AppController.name);

  constructor(private readonly clickhouseService: ClickhouseService) {}

  @MessagePattern(process.env.NC_KINESIS_STREAM || 'nocohub-dev-input-stream')
  async syncApiExecTime(@Payload() messages: any[]) {
    try {
      const rows = [];

      // Process the batch of messages
      messages.forEach((data) => {
        if (!data.url) return;

        // Extract the necessary data from the message
        const {
          workspace_id,
          user_id,
          project_id,
          url,
          method,
          status,
          exec_time,
          timestamp,
        } = data;

        rows.push(
          `(${
            Math.round(timestamp / 1000) ?? 'NOW()'
          }, '${workspace_id}', '${user_id}', '${project_id}', '${url}', '${method}', ${exec_time}, ${
            status ?? 'NULL'
          })`,
        );
      });

      // Generate the ClickHouse insert query
      const insertQuery = `INSERT INTO api_calls (timestamp, workspace_id, user_id, project_id, url, method, exec_time, status) 
                         VALUES ${rows.join(',')}`;

      await this.clickhouseService.execute(insertQuery);
    } catch (e) {
      this.logger.log(e);
    }
  }
}
