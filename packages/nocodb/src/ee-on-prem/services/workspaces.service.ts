import { WorkspacesService as WorkspacesServiceEE } from 'src/ee/services/workspaces.service';
import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LicenseService } from '../services/license/license.service';
import type { AppConfig, NcRequest } from '~/interface/config';
import type { UserType, WorkspaceType } from 'nocodb-sdk';
import type { User } from '~/models';
import { TablesService } from '~/services/tables.service';
import { BasesService } from '~/services/bases.service';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { PaymentService } from '~/modules/payment/payment.service';
import { NcError } from '~/helpers/catchError';
import { Workspace } from '~/models';

@Injectable()
export class WorkspacesService extends WorkspacesServiceEE {
  constructor(
    protected appHooksService: AppHooksService,
    protected configService: ConfigService<AppConfig>,
    protected basesService: BasesService,
    protected tablesService: TablesService,
    @Inject(forwardRef(() => 'JobsService')) protected jobsService,
    protected paymentService: PaymentService,
    protected licenseService: LicenseService,
  ) {
    super(
      appHooksService,
      configService,
      basesService,
      tablesService,
      jobsService,
      paymentService,
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

    if (
      this.licenseService.isTrial() &&
      userWorkspacesCount >= this.licenseService.getMaxWorkspacePerUser()
    ) {
      NcError.notAllowed(
        `Trial license allows only ${this.licenseService.getMaxWorkspacePerUser()} workspace${
          this.licenseService.getMaxWorkspacePerUser() > 1 ? 's' : ''
        } per user. Please upgrade to create more workspaces.`,
      );
    }

    if (this.licenseService.getMaxWorkspaces()) {
      // get total non-deleted workspaces
      const workspacesCount = await Workspace.count({
        deleted: false,
      });

      if (workspacesCount >= this.licenseService.getMaxWorkspaces()) {
        NcError.notAllowed(
          `Maximum workspace limit reached. Please upgrade license to create more workspaces.`,
        );
      }
    }

    if (this.licenseService.getOneWorkspace()) {
      const firstWorkspace = await Workspace.getFirstWorkspace();
      if (firstWorkspace) {
        NcError.notAllowed('One workspace license allows only one workspace.');
      }
    }

    return super.create(param);
  }

  public async createDefaultWorkspace(user: User, req: any) {
    // check if oneWorkspace enabled and if enabled then allow only one workspace create
    if (this.licenseService.getOneWorkspace()) {
      const firstWorkspace = await Workspace.getFirstWorkspace();
      if (firstWorkspace) {
        return;
      }
    }

    if (this.licenseService.getMaxWorkspaces()) {
      // get total non-deleted workspaces
      const workspacesCount = await Workspace.count({
        deleted: false,
      });

      if (workspacesCount >= this.licenseService.getMaxWorkspaces()) {
        NcError.maxWorkspaceLimitReached();
      }
    }

    return super.createDefaultWorkspace(user, req);
  }
}
