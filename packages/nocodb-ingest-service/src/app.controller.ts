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

  @MessagePattern(
    process.env.AWS_KINESIS_STREAM ||
      process.env.NC_KAFKA_TOPIC ||
      'nocohub-dev-input-stream',
  )
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
          ip,
        } = data;

        let ipv4 = 'NULL';
        let ipv6 = 'NULL';

        if (/^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/.test(ip)) {
          ipv6 = `'${ip}'`;
        } else if (/^([0-9]{1,3}\.){3}[0-9]{1,3}$/.test(ip)) {
          ipv4 = `'${ip}'`;
        }

        rows.push(
          `(${
            Math.round(timestamp / 1000) ?? 'NOW()'
          }, '${workspace_id}', '${user_id}', '${project_id}', '${url}', '${method}', ${exec_time}, ${
            status ?? 'NULL'
          }, ${ipv4}, ${ipv6})`,
        );
      });

      // Generate the ClickHouse insert query
      const insertQuery = `INSERT INTO api_calls (timestamp, workspace_id, user_id, project_id, url, method, exec_time, status, req_ipv4, req_ipv6) 
                         VALUES ${rows.join(',')}`;

      await this.clickhouseService.execute(insertQuery);
    } catch (e) {
      this.logger.log(e);
    }
  }
}
