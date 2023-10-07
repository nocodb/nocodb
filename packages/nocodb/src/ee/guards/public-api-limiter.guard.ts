import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { ThrottlerStorage } from '@nestjs/throttler/dist/throttler-storage.interface';
import { Reflector } from '@nestjs/core';
import { PublicApiLimiterGuard as PublicApiLimiterGuardCE } from 'src/guards/public-api-limiter.guard';
import type { ExecutionContext } from '@nestjs/common';
import  requestIp from 'request-ip';

@Injectable()
class PublicApiLimiterGuardEE extends ThrottlerGuard {
  constructor(
    protected _config,
    protected storageService: ThrottlerStorage,
    protected reflector: Reflector,
  ) {
    super(
      {
        ..._config,
        throttlers: _config.throttlers.filter((t) => t.name === 'public'),
      },
      storageService,
      reflector,
    );
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // const req = context.switchToHttp().getRequest();
    return super.canActivate(context);
  }

  protected async getTracker(req: Record<string, any>): Promise<string> {
    return `public|${requestIp.getClientIp(req)}` as string;
  }

  generateKey(context, suffix) {
    return `throttler:${suffix}`;
  }
}

const enableThrottler = !!process.env['NC_THROTTLER_REDIS'];

const AuthGuard = enableThrottler
  ? PublicApiLimiterGuardEE
  : PublicApiLimiterGuardCE;

export { AuthGuard as PublicApiLimiterGuard };
