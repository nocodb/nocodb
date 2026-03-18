import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { ThrottlerStorage } from '@nestjs/throttler/dist/throttler-storage.interface';
import { Reflector } from '@nestjs/core';
import { MetaApiLimiterGuard as MetaApiLimiterGuardCE } from 'src/guards/meta-api-limiter.guard';
import type { ExecutionContext } from '@nestjs/common';
import { throttlerEnabled } from '~/helpers/redisHelpers';
import Noco from '~/Noco';

/**
 * Separate rate limiter for SCIM endpoints.
 * Uses the 'scim' throttler (higher limit than 'meta') keyed on the
 * Bearer token so each SCIM provisioning token gets its own bucket.
 */
@Injectable()
class ScimApiLimiterGuardEE extends ThrottlerGuard {
  constructor(
    protected _config,
    protected storageService: ThrottlerStorage,
    protected reflector: Reflector,
  ) {
    super(
      {
        ..._config,
        throttlers: _config.throttlers.filter((t) => t.name === 'scim'),
      },
      storageService,
      reflector,
    );
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Bypass rate limiting for unlicensed on-prem (CE-equivalent)
    if (!Noco.isEE()) return true;

    const req = context.switchToHttp().getRequest();
    const authHeader = req.headers['authorization'];
    // Only throttle if there's a bearer token (SCIM always has one)
    return authHeader ? super.canActivate(context) : true;
  }

  protected async getTracker(req: Record<string, any>): Promise<string> {
    // Key on the bearer token so each SCIM provisioning token gets its own bucket
    const authHeader = req.headers['authorization'] || '';
    const token = authHeader.replace(/^Bearer\s+/i, '');
    return `scim|${token}`;
  }

  generateKey(context, suffix) {
    return `throttler:${suffix}`;
  }
}

// Fallback to CE no-op guard when throttler (Redis) is not enabled
const enableThrottler = throttlerEnabled();
const Guard = enableThrottler ? ScimApiLimiterGuardEE : MetaApiLimiterGuardCE;
export { Guard as ScimApiLimiterGuard };
