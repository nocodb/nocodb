import { Injectable } from '@nestjs/common';
import { tap } from 'rxjs';
import Client from 'ioredis';
import type {
  CallHandler,
  ExecutionContext,
  NestInterceptor,
} from '@nestjs/common';
import type { Observable } from 'rxjs';
import type Redis from 'ioredis';

@Injectable()
export class ExecutionTimeCalculatorInterceptor implements NestInterceptor {
  client: Redis;

  constructor() {
    this.client = new Client(process.env['NC_THROTTLER_REDIS']);
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    // const response = context.switchToHttp().getResponse();
    const startTime = performance.now();

    return next.handle().pipe(
      tap(() => {
        if( !req.headers['xc-token'] && !req.headers['xc-auth']){
          return;
        }

        const endTime = performance.now();
        const executionTime = endTime - startTime;
        console.log(`Execution time: ${executionTime} ms`);

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
