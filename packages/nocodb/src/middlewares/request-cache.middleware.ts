import { Injectable } from '@nestjs/common';
import { runWithRequestCache } from '~/decorators/nc-cache.decorator';
import type { NestMiddleware } from '@nestjs/common';

/**
 * Opens a request-scoped cache for `@NcCache` decorated methods.
 *
 * Without this middleware the decorator is a pass-through, so this is what turns
 * the memoization on. It must run before anything that reads metadata, which is
 * why it is applied first in `AppModule.configure`.
 *
 * `next()` is called inside the scope: AsyncLocalStorage propagates through the
 * rest of the middleware chain, the controller and everything it awaits, and the
 * map is dropped once that async tree settles.
 */
@Injectable()
export class RequestCacheMiddleware implements NestMiddleware {
  use(_req: any, _res: any, next: () => void) {
    runWithRequestCache(() => next());
  }
}
