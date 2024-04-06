import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { ThrottlerStorage } from '@nestjs/throttler/dist/throttler-storage.interface';
import { Reflector } from '@nestjs/core';
import { DataApiLimiterGuard as DataApiLimiterGuardCE } from 'src/guards/data-api-limiter.guard';
import type { ExecutionContext } from '@nestjs/common';

const HEADER_NAME = 'xc-token';
const HEADER_NAME1 = 'xc-auth';

@Injectable()
export class DataApiLimiterGuardEE extends ThrottlerGuard {
  constructor(
    protected _config,
    protected storageService: ThrottlerStorage,
    protected reflector: Reflector,
  ) {
    super(
      {
        ..._config,
        throttlers: _config.throttlers.filter((t) => t.name === 'data'),
      },
      storageService,
      reflector,
    );
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    return req.headers[HEADER_NAME] || req.headers[HEADER_NAME1]
      ? super.canActivate(context)
      : true;
  }

  protected async getTracker(req: Record<string, any>): Promise<string> {
    return `data|${
      req.headers[HEADER_NAME] || req.headers[HEADER_NAME1]
    }` as string;
  }

  generateKey(context, suffix) {
    return `throttler:${suffix}`;
  }
}

// to avoid issue if throttler is not enabled
const enableThrottler = !!process.env['NC_THROTTLER_REDIS'];
const AuthGuard = enableThrottler
  ? DataApiLimiterGuardEE
  : DataApiLimiterGuardCE;

export { AuthGuard as DataApiLimiterGuard };
