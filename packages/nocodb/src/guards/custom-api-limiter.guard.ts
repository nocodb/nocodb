import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { ExtractProjectAndWorkspaceIdMiddleware } from '../middlewares/extract-project-and-workspace-id/extract-project-and-workspace-id.middleware';
import type { ExecutionContext } from '@nestjs/common';

const HEADER_NAME = 'xc-token';
const HEADER_NAME_2 = 'xc-auth';

@Injectable()
export class CustomApiLimiterGuard extends ThrottlerGuard {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      const guard = new ExtractProjectAndWorkspaceIdMiddleware();
      await guard.canActivate(context);
    } catch (e) {
      console.log(e);
    }
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
