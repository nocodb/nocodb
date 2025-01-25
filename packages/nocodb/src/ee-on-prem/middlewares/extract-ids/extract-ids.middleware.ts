import { Injectable } from '@nestjs/common';
import { ExtractIdsMiddleware as ExtractIdsMiddlewareEE } from 'src/ee/middlewares/extract-ids/extract-ids.middleware';
import type {
  CanActivate,
  ExecutionContext,
  NestMiddleware,
} from '@nestjs/common';
import { NcError } from '~/helpers/catchError';

import { LicenseService } from '~/services/license/license.service';
import { Workspace } from '~/models';

// todo: refactor name since we are using it as auth guard
@Injectable()
export class ExtractIdsMiddleware
  extends ExtractIdsMiddlewareEE
  implements NestMiddleware, CanActivate
{
  private cachedWorkspaceId: string = null;

  constructor(private licenseService: LicenseService) {
    super();
  }

  async use(req, res, next): Promise<any> {
    return super.use(req, res, next);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    return super.canActivate(context);
  }

  // additional validation logic which can be overridden
  protected async additionalValidation1(param: {
    next: any;
    res: any;
    req: any;
  }) {
    // check if oneWorkspace enabled and if enabled then allow only one workspace which is first in the list
    if (!this.licenseService.getOneWorkspace()) {
      return super.additionalValidation(param);
    }

    if (
      !param.req.ncWorkspaceId ||
      param.req.ncWorkspaceId === this.cachedWorkspaceId
    ) {
      return super.additionalValidation(param);
    }

    const firstWorkspace = await Workspace.getFirstWorkspace();

    if (firstWorkspace?.id === param.req.ncWorkspaceId) {
      this.cachedWorkspaceId = firstWorkspace?.id;
      return super.additionalValidation(param);
    }

    NcError.notAllowed(
      'One workspace enabled and only first workspace is allowed to access',
    );
  }
}

export * from 'src/ee/middlewares/extract-ids/extract-ids.middleware';
