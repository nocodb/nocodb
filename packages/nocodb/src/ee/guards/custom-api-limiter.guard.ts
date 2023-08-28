import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { ExecutionContext } from '@nestjs/common';
import { ExtractIdsMiddleware } from '~/middlewares/extract-ids/extract-ids.middleware';

const HEADER_NAME = 'xc-token';
const HEADER_NAME_2 = 'xc-auth';

@Injectable()
export class CustomApiLimiterGuard extends ThrottlerGuard {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const guard = new ExtractIdsMiddleware();
    await guard.canActivate(context);

    const req = context.switchToHttp().getRequest();

    return req.headers[HEADER_NAME] || req.headers[HEADER_NAME_2]
      ? super.canActivate(context)
      : true;
  }

  protected getTracker(req: Record<string, any>): string {
    return `${req.ncWorkspaceId ?? 'default'}|${
      req.headers[HEADER_NAME] ?? req.headers[HEADER_NAME_2]
    }` as string;
  }

  generateKey(context, suffix) {
    return `throttler:${suffix}`;
  }
}
