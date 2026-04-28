import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { ThrottlerRequest } from '@nestjs/throttler';
import { getApiTokenFromHeader } from '~/helpers';

const NC_RATE_LIMIT_ACCUMULATOR = Symbol('nc-rate-limit-accumulator');

interface RateLimitState {
  name: string;
  limit: number;
  remaining: number;
  reset: number;
}

@Injectable()
export class CanonicalThrottlerGuard extends ThrottlerGuard {
  protected async handleRequest(
    requestProps: ThrottlerRequest,
  ): Promise<boolean> {
    const {
      context,
      limit,
      ttl,
      throttler,
      blockDuration,
      getTracker,
      generateKey,
    } = requestProps;
    const { req, res } = this.getRequestResponse(context);

    const ignoreUserAgents =
      throttler.ignoreUserAgents ?? this.commonOptions.ignoreUserAgents;
    if (Array.isArray(ignoreUserAgents)) {
      for (const pattern of ignoreUserAgents) {
        if (pattern.test(req.headers['user-agent'])) {
          return true;
        }
      }
    }

    const tracker = await getTracker(req, context);
    const key = generateKey(context, tracker, throttler.name);
    const { totalHits, timeToExpire, isBlocked, timeToBlockExpire } =
      await this.storageService.increment(
        key,
        ttl,
        limit,
        blockDuration,
        throttler.name,
      );

    if (isBlocked) {
      res.header('Retry-After', timeToBlockExpire);
      await this.throwThrottlingException(context, {
        limit,
        ttl,
        key,
        tracker,
        totalHits,
        timeToExpire,
        isBlocked,
        timeToBlockExpire,
      });
    }

    // Only expose rate-limit headers on xc-token (API access) requests.
    if (!getApiTokenFromHeader(req)) {
      return true;
    }

    const remaining = Math.max(0, limit - totalHits);
    const acc: RateLimitState | undefined = (req as any)[
      NC_RATE_LIMIT_ACCUMULATOR
    ];
    if (!acc || remaining < acc.remaining) {
      (req as any)[NC_RATE_LIMIT_ACCUMULATOR] = {
        name: throttler.name,
        limit,
        remaining,
        reset: timeToExpire,
      };
    }

    const winner: RateLimitState = (req as any)[NC_RATE_LIMIT_ACCUMULATOR];
    res.header('X-RateLimit-Limit', winner.limit);
    res.header('X-RateLimit-Remaining', winner.remaining);
    res.header('X-RateLimit-Reset', winner.reset);
    res.header('X-RateLimit-Policy', winner.name);

    return true;
  }
}
