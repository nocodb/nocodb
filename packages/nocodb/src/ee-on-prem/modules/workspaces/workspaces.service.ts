import { WorkspacesService as WorkspacesServiceEE } from 'src/ee/modules/workspaces/workspaces.service';
import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig, NcRequest } from '~/interface/config';
import type { UserType, WorkspaceType } from 'nocodb-sdk';
import { TablesService } from '~/services/tables.service';
import { BasesService } from '~/services/bases.service';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { LicenseService } from '~/ee-on-prem/services/license/license.service';
import { NcError } from '~/helpers/catchError';
import { Workspace } from '~/models';

@Injectable()
export class WorkspacesService extends WorkspacesServiceEE {
  constructor(
    private appHooksService: AppHooksService,
    private configService: ConfigService<AppConfig>,
    private basesService: BasesService,
    private tablesService: TablesService,
    @Inject(forwardRef(() => 'JobsService')) private jobsService,
    private licenseService: LicenseService,
  ) {
    super(
      appHooksService,
      configService,
      basesService,
      tablesService,
      jobsService,
    );
  }

  async create(param: {
    user: UserType;
    workspaces: WorkspaceType | WorkspaceType[];
    req: NcRequest;
  }) {
    const userWorkspacesCount = await Workspace.count({
      fk_user_id: param.user.id,
    });

    if (this.licenseService.isTrial() && userWorkspacesCount > 0) {
      NcError.notAllowed(
        'Trial plan allows only 1 workspace. Please upgrade to create more workspaces.',
      );
    }

    return super.create(param);
  }
}
