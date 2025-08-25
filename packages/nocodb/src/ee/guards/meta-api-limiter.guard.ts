import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { ThrottlerStorage } from '@nestjs/throttler/dist/throttler-storage.interface';
import { Reflector } from '@nestjs/core';
import { MetaApiLimiterGuard as MetaApiLimiterGuardCE } from 'src/guards/meta-api-limiter.guard';
import type { ExecutionContext } from '@nestjs/common';
import { throttlerEnabled } from '~/helpers/redisHelpers';
import { getApiTokenFromAuthHeader } from '~/helpers';

const HEADER_NAME = 'xc-token';
const HEADER_NAME_GUI = 'xc-auth';
const HEADER_NAME_AUTH = 'authorization';

@Injectable()
export class MetaApiLimiterGuardEE extends ThrottlerGuard {
  constructor(
    protected _config,
    protected storageService: ThrottlerStorage,
    protected reflector: Reflector,
  ) {
    super(
      {
        ..._config,
        throttlers: _config.throttlers.filter(
          (t) => t.name === 'meta' || t.name === 'meta-gui',
        ),
      },
      storageService,
      reflector,
    );
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    return req.headers[HEADER_NAME] ||
      req.headers[HEADER_NAME_GUI] ||
      getApiTokenFromAuthHeader(req.headers[HEADER_NAME_AUTH])
      ? super.canActivate(context)
      : true;
  }

  protected async getTracker(req: Record<string, any>): Promise<string> {
    return `meta|${
      req.headers[HEADER_NAME] ||
      req.headers[HEADER_NAME_GUI] ||
      getApiTokenFromAuthHeader(req.headers[HEADER_NAME_AUTH])
    }` as string;
  }

  generateKey(context, suffix) {
    return `throttler:${suffix}`;
  }
}

// to avoid issue if throttler is not enabled
const enableThrottler = throttlerEnabled();
const AuthGuard = enableThrottler
  ? MetaApiLimiterGuardEE
  : MetaApiLimiterGuardCE;
export { AuthGuard as MetaApiLimiterGuard };
