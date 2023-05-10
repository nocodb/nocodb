import { Injectable } from '@nestjs/common';
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
import type { AppConfig } from '../../interface/config';

@Injectable()
export class ExecutionTimeCalculatorInterceptor implements NestInterceptor {
  client: Redis;

  constructor(private readonly configService: ConfigService<AppConfig>) {
    // todo: use a single redis connection
    this.client = new Client(process.env['NC_THROTTLER_REDIS']);
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();

    const enabled = this.configService.get('throttler.calc_execution_time', {
      infer: true,
    });
    if (!enabled || (!req.headers['xc-token'] && !req.headers['xc-auth'])) {
      return;
    }

    const startTime = performance.now();

    return next.handle().pipe(
      tap(() => {
        const endTime = performance.now();
        const executionTime = endTime - startTime;

        const key = `exec:${req.ncWorkspaceId || 'default'}|${
          req.headers['xc-token'] || req.headers['xc-auth']
        }`;

        this.updateExecTime(key, Math.round(executionTime));
      }),
    );
  }

  private updateExecTime(key: string, val: number) {
    this.client.incrby(key, val);
  }
}
