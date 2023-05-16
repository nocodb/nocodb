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
// import { ClickhouseTables } from 'nocodb-sdk';

// todo: replace with nocodb-sdk
//    add nocodb-sdk dependency and update docker build
enum ClickhouseTables {
  API_CALLS = 'usage_api_calls',
  API_COUNT = 'usage_api_count',
  NOTIFICATION = 'nc_notification',
  PAGE_SNAPSHOT = 'docs_page_snapshot',
  TELEMETRY = 'usage_telemetry',
  AUDIT = 'nc_audit',
}

function sanitiseVal(val: any) {
  switch (typeof val) {
    case 'string':
      return `'${val.replace(/'/g, "''")}'`;
    case 'number':
      return val;
    case 'boolean':
      return val ? 1 : 0;
    case 'undefined':
      return 'NULL';
    case 'object':
      if (val === null) {
        return 'NULL';
      }
      return `'${JSON.stringify(
        val,
        // escape single quotes
        (key, val) => {
          if (typeof val === 'string') {
            return val.replace(/'/g, "'");
          }
          return val;
        },
      )}'`;
    default:
      return `'${val}'`;
  }
}

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
          `(${Math.round(timestamp / 1000) ?? 'NOW()'}, ${[
            workspace_id,
            user_id,
            project_id,
            url,
            method,
            exec_time,
            status,
          ]
            .map(sanitiseVal)
            .join(',')}, ${ipv4}, ${ipv6})`,
        );
      });

      // Generate the ClickHouse insert query
      const insertQuery = `INSERT INTO ${
        ClickhouseTables.API_CALLS
      } (timestamp, workspace_id, user_id, project_id, url, method, exec_time, status, req_ipv4, req_ipv6)
                         VALUES ${rows.join(',')}`;

      await this.clickhouseService.execute(insertQuery);
    } catch (e) {
      throw e;
    }
  }

  @MessagePattern('cloud-audit')
  async audit(@Payload() messages: any[]) {
    try {
      const rows = [];

      // Process the batch of messages
      messages.forEach((data) => {
        // Extract the necessary data from the message
        const {
          timestamp,
          event,
          email,
          user_id,
          ip,
          base_id,
          project_id,
          workspace_id,
          fk_model_id,
          row_id,
          op_type,
          op_sub_type,
          status,
          description,
          details,
        } = data;

        let ipv4 = 'NULL';
        let ipv6 = 'NULL';

        if (/^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/.test(ip)) {
          ipv6 = `'${ip}'`;
        } else if (/^([0-9]{1,3}\.){3}[0-9]{1,3}$/.test(ip)) {
          ipv4 = `'${ip}'`;
        }

        rows.push(
          `(generateUUIDv4(),${Math.round(timestamp / 1000) ?? 'NOW()'}, ${[
            event,
            email,
            user_id,
            base_id,
            project_id,
            workspace_id,
            fk_model_id,
            row_id,
            op_type,
            op_sub_type,
            status,
            description,
            details,
          ]
            .map(sanitiseVal)
            .join(',')},${ipv4},${ipv6})`,
        );
      });

      // Generate the ClickHouse insert query
      const insertQuery = `INSERT INTO ${
        ClickhouseTables.AUDIT
      } (id,timestamp,event,email,user_id,base_id,project_id,workspace_id,fk_model_id,row_id,op_type,op_sub_type,status,description,details,req_ipv4,req_ipv6)
                         VALUES ${rows.join(',')}`;

      await this.clickhouseService.execute(insertQuery);
    } catch (e) {
      throw e;
    }
  }

  @MessagePattern('cloud-telemetry')
  async teleEvent(@Payload() messages: any[]) {
    try {
      const rows = [];

      // Process the batch of messages
      messages.forEach((data) => {
        // Extract the necessary data from the message
        const { timestamp, event, package_id, path, ip, ...properties } = data;

        let ipv4 = 'NULL';
        let ipv6 = 'NULL';

        if (/^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/.test(ip)) {
          ipv6 = `'${ip}'`;
        } else if (/^([0-9]{1,3}\.){3}[0-9]{1,3}$/.test(ip)) {
          ipv4 = `'${ip}'`;
        }

        rows.push(
          `(generateUUIDv4(),${
            Math.round(timestamp / 1000) ?? 'NOW()'
          },'${event}','${package_id}','${path}',${ipv4},${ipv6},'${JSON.stringify(
            properties,
            // escape single quotes
            (key, val) => {
              if (typeof val === 'string') {
                return val.replace(/'/g, "'");
              }
              return val;
            },
          )}')`,
        );
      });

      // Generate the ClickHouse insert query
      const insertQuery = `INSERT INTO ${
        ClickhouseTables.TELEMETRY
      } (id,timestamp,event,package_id,url,req_ipv4,req_ipv6,properties) 
                         VALUES ${rows.join(',')}`;

      await this.clickhouseService.execute(insertQuery);
    } catch (e) {
      throw e;
    }
  }
}
