import { Inject, Injectable } from '@nestjs/common';
import { tap } from 'rxjs';
import Client from 'ioredis';
import { ConfigService } from '@nestjs/config';
import type {
  CallHandler,
  ExecutionContext,
  NestInterceptor,
} from '@nestjs/common';
import type { Observable } from 'rxjs';
import type Redis from 'ioredis';
import type { AppConfig } from '~/interface/config';
import { Producer } from '~/services/producer/producer';

// This interceptor is no longer in use and keeping it for future reference
// It calculates the execution time of the request and sends it to the producer
// It also updates the execution time in Redis if the config is enabled and the request has a token
// The producer is used to send messages to Kafka or Kinesis
@Injectable()
export class ExecutionTimeCalculatorInterceptor implements NestInterceptor {
  private client: Redis;

  constructor(
    private readonly configService: ConfigService<AppConfig>,
    @Inject(Producer) private producer: Producer,
  ) {
    if (process.env['NC_THROTTLER_REDIS']) {
      // todo: use a single redis connection
      this.client = new Client(process.env['NC_THROTTLER_REDIS']);
    }
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const res = context.switchToHttp().getResponse();
    const timestamp = Date.now();

    const enabled = this.configService.get('throttler.calc_execution_time', {
      infer: true,
    });
    const startTime = performance.now();

    return next.handle().pipe(
      tap(() => {
        const endTime = performance.now();
        const exec_time = Math.round(endTime - startTime);

        const workspace_id = req.ncWorkspaceId || 'default';
        const user_id = req.user?.id;
        const base_id = req.ncBaseId;

        // const token = req.headers['xc-token'] || req.headers['xc-auth'];

        const url = req.route?.path ?? req.url;
        const method = req.method;
        const status = +res?.statusCode || 0;
        const ip = req.clientIp;

        this.producer.sendMessage(
          process.env.AWS_KAFKA_TOPIC ||
            process.env.AWS_KINESIS_STREAM ||
            'nocohub-dev-input-stream',
          JSON.stringify({
            created_at: timestamp,
            workspace_id,
            user_id,
            base_id,
            // token,
            url,
            method,
            exec_time,
            status,
            ip,
          }),
        );

        if (
          !this.client ||
          !enabled ||
          (!req.headers['xc-token'] && !req.headers['xc-auth'])
        ) {
          return;
        }

        const key = `exec:${req.ncWorkspaceId || 'default'}|${
          req.headers['xc-token'] || req.headers['xc-auth']
        }`;

        this.updateExecTime(key, exec_time);
      }),
    );
  }

  private updateExecTime(key: string, val: number) {
    this.client.incrby(key, val);
  }
}
