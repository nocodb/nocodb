import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { ExtractProjectAndWorkspaceIdMiddleware } from '../middlewares/extract-project-and-workspace-id/extract-project-and-workspace-id.middleware';
import type { ExecutionContext } from '@nestjs/common';

const HEADER_NAME = 'xc-token';

@Injectable()
export class CustomApiLimiterGuard extends ThrottlerGuard {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      const guard = new ExtractProjectAndWorkspaceIdMiddleware();
      await guard.canActivate(context);
    } catch (e) {
      console.log(e);
    }

    return !context.switchToHttp().getRequest().headers[HEADER_NAME]
      ? super.canActivate(context)
      : true;
  }

  protected getTracker(req: Record<string, any>): string {
    return `${req.ncWorkspaceId ?? 'default'}|${
      req.headers[HEADER_NAME]
    }` as string;
  }
  generateKey(context, suffix) {
    return `throttler:${suffix}`;
  }
}
