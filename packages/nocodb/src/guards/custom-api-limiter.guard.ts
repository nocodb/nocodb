import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { ExtractProjectAndWorkspaceIdMiddleware } from '../middlewares/extract-project-and-workspace-id/extract-project-and-workspace-id.middleware';
import type { ExecutionContext } from '@nestjs/common';

@Injectable()
export class CustomApiLimiterGuard extends ThrottlerGuard {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      const guard = new ExtractProjectAndWorkspaceIdMiddleware();
      await guard.canActivate(context);
    } catch (e) {
      console.log(e);
    }
    return super.canActivate(context);
  }

  protected getTracker(req: Record<string, any>): string {
    return `${req.ncWorkspaceId ?? 'default'}|${
      req.headers['xc-auth']
    }` as string;
  }
  generateKey(context, suffix) {
    return `throttler:${suffix}`;
  }
}
