import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { ExecutionContext } from '@nestjs/common';
import { NcError } from '~/helpers/catchError';

@Injectable()
export class ScimAuthGuard extends AuthGuard('scim-bearer') {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();

    // Extract workspace ID from route params
    const workspaceId = request.params.workspaceId;

    if (!workspaceId) {
      throw NcError.badRequest('Workspace ID is required');
    }

    // Store workspace ID for strategy access
    request.workspaceId = workspaceId;

    return super.canActivate(context);
  }

  handleRequest(err, user, info) {
    if (err || !user) {
      throw err || NcError.unauthorized('SCIM authentication failed');
    }
    return user;
  }
}
