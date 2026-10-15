import { Injectable, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import type { RoutePlane } from '~/helpers/routePlane';
import { ROUTE_PLANE, routePlaneForPath } from '~/helpers/routePlane';

// Runtime net behind the route-map test: a reserved-prefix route without its plane decorator answers like a missing route.
@Injectable()
export class RoutePlaneGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== 'http') return true;

    const req = context.switchToHttp().getRequest();
    const required = routePlaneForPath(
      `${req.baseUrl ?? ''}${req.route?.path ?? ''}`,
    );
    if (!required) return true;

    const plane = this.reflector.getAllAndOverride<RoutePlane>(ROUTE_PLANE, [
      context.getHandler(),
      context.getClass(),
    ]);
    // Nest's own unmatched-route error, so a blocked route looks like a missing one.
    if (plane !== required) {
      throw new NotFoundException(`Cannot ${req.method} ${req.path}`);
    }

    return true;
  }
}
