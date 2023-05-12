import { Injectable } from '@nestjs/common';
import { tap } from 'rxjs';
import Client from 'ioredis';
import { ConfigService } from '@nestjs/config';
import { KafkaProducer } from '../../modules/kafka/kafka-producer';
import type {
  CallHandler,
  ExecutionContext,
  NestInterceptor,
} from '@nestjs/common';
import type { Observable } from 'rxjs';
import type Redis from 'ioredis';
import type { AppConfig } from '../../interface/config';

@Injectable()
export class ExecutionTimeCalculatorInterceptor implements NestInterceptor {
  client: Redis;

  constructor(
    private readonly configService: ConfigService<AppConfig>,
    private readonly kafkaProducer: KafkaProducer,
  ) {
    // todo: use a single redis connection
    // this.client = new Client(process.env['NC_THROTTLER_REDIS']);
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const res = context.switchToHttp().getResponse();

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
        const project_id = req.ncProjectId;

        const token = req.headers['xc-token'] || req.headers['xc-auth'];

        const url = req.route?.path ?? req.url;
        const method = req.method;
        const status = +res?.statusCode || 0;

        this.kafkaProducer.sendMessage(
          'api_exec_time',
          JSON.stringify({
            workspace_id,
            user_id,
            project_id,
            // token,
            url,
            method,
            exec_time,
            status,
          }),
        );

        if (!this.client || !enabled || (!req.headers['xc-token'] && !req.headers['xc-auth'])) {
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
