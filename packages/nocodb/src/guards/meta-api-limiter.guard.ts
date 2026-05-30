import { Injectable } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';

// Rate limiting is intentionally not enforced at the application layer.
// Deployments are expected to apply rate limits at the network layer (reverse
// proxy, load balancer, WAF, or API gateway), where IP-based throttling can be
// applied without requiring a shared store inside the app. This pass-through
// guard is therefore deliberate, not a missing control.
@Injectable()
export class MetaApiLimiterGuard implements CanActivate {
  async canActivate(_context: ExecutionContext): Promise<boolean> {
    return true;
  }
}
