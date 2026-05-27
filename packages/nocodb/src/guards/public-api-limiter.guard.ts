import { Injectable } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';

// CE stub — application-level rate limiting is not performed in CE. CE
// deployments are expected to enforce rate limits at the network layer
// (reverse proxy, load balancer, WAF, or API gateway) where IP-based
// throttling can be applied without requiring a shared store inside the app.
// The real in-app implementation lives in
// `src/ee/guards/public-api-limiter.guard.ts` (extends CanonicalThrottlerGuard)
// and is swapped in at module load when `NC_REDIS_URL` / `NC_THROTTLER_REDIS`
// is set, since cluster-wide throttling requires a shared backing store.
@Injectable()
export class PublicApiLimiterGuard implements CanActivate {
  async canActivate(_context: ExecutionContext): Promise<boolean> {
    return true;
  }
}
