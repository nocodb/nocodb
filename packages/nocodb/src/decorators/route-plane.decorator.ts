import { SetMetadata, UseGuards } from '@nestjs/common';
import type { CanActivate, Type } from '@nestjs/common';
import type { RoutePlane } from '~/helpers/routePlane';
import { ROUTE_PLANE } from '~/helpers/routePlane';
import { DeployHookGuard } from '~/guards/deploy-hook.guard';
import { OperatorGuard } from '~/guards/operator.guard';

interface RoutePlaneOptions {
  // Run ahead of the auth guard, e.g. MetaApiLimiterGuard.
  guards?: Type<CanActivate>[];
}

const routePlane =
  (plane: RoutePlane, guards: Type<CanActivate>[]) =>
  (target: any, key?: string, descriptor?: PropertyDescriptor) => {
    SetMetadata(ROUTE_PLANE, plane)(target, key, descriptor);
    UseGuards(...guards)(target, key, descriptor);
  };

export const OperatorApi = (
  options: RoutePlaneOptions & {
    // Replaces OperatorGuard; the marketplace's guard also admits an operator session.
    authGuard?: Type<CanActivate>;
  } = {},
) =>
  routePlane('operator', [
    ...(options.guards ?? []),
    options.authGuard ?? OperatorGuard,
  ]);

export const DeployHook = (options: RoutePlaneOptions = {}) =>
  routePlane('deploy', [...(options.guards ?? []), DeployHookGuard]);
