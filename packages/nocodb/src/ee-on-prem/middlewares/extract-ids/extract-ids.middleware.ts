import { Injectable } from '@nestjs/common';

import { ExtractIdsMiddleware as ExtractIdsMiddlewareEE } from 'src/ee/middlewares/extract-ids/extract-ids.middleware';
import { NcError } from '~/helpers/catchError';

import { LicenseService } from '~/services/license/license.service';
import { Workspace } from '~/models';

// todo: refactor name since we are using it as auth guard
@Injectable()
export class ExtractIdsMiddleware extends ExtractIdsMiddlewareEE {
  private cachedWorkspaceId: string = null;
  constructor(private licenseService: LicenseService) {
    super();
  }
  // additional validation logic which can be overridden
  protected async additionalValidation(param: {
    next: any;
    res: any;
    req: any;
  }) {
    // check if oneWorkspace enabled and if enabled then allow only one workspace which is first in the list
    if (!this.licenseService.getOneWorkspace()) {
      return;
    }

    if (
      !param.req.ncWorkspaceId ||
      param.req.ncWorkspaceId === this.cachedWorkspaceId
    ) {
      return;
    }

    const firstWorkspace = await Workspace.getFirstWorkspace();

    if (firstWorkspace?.id === param.req.ncWorkspaceId) {
      this.cachedWorkspaceId = firstWorkspace?.id;
      return;
    }

    NcError.notAllowed(
      'One workspace enabled and only first workspace is allowed to access',
    );
  }
}

export * from 'src/ee/middlewares/extract-ids/extract-ids.middleware';
