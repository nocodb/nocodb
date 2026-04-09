import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { ExecutionContext } from '@nestjs/common';
import { NcError } from '~/helpers/catchError';

@Injectable()
export class ScimAuthGuard extends AuthGuard('scim-bearer') {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();

    // Extract workspace ID from route params
    const orgId = request.params.orgId;

    if (!orgId) {
      throw NcError.badRequest('Organization ID is required');
    }

    // Store workspace ID for strategy access
    request.orgId = orgId;

    // Set request.context so @TenantContext() decorator works for SCIM controllers
    request.context = {
      org_id: orgId,
      workspace_id: null,
      base_id: null,
    };

    return super.canActivate(context);
  }

  handleRequest(err, user, _info) {
    if (err || !user) {
      throw err || NcError.unauthorized('SCIM authentication failed');
    }
    return user;
  }
}
