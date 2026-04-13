import { WorkspacesService as WorkspacesServiceEE } from 'src/ee/services/workspaces.service';
import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  EnterpriseOrgUserRoles,
  extractRolesObj,
  OrgUserRoles,
  PlanLimitTypes,
  WorkspaceUserRoles,
} from 'nocodb-sdk';
import type { AppConfig, NcRequest } from '~/interface/config';
import type { BaseType, UserType, WorkspaceType } from 'nocodb-sdk';
import type { User } from '~/models';
import { TablesService } from '~/services/tables.service';
import { BasesService } from '~/services/bases.service';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { PaymentService } from '~/modules/payment/payment.service';
import { NcError } from '~/helpers/catchError';
import { PagedResponseImpl } from '~/helpers/PagedResponse';
import { Base, Workspace, WorkspaceUser } from '~/models';
import { MetaTable } from '~/utils/globals';
import Noco from '~/Noco';
import {
  verifyDefaultWorkspace,
  verifyDefaultWsOwner,
} from '~/helpers/verifyDefaultWorkspace';
import { getOnPremPlan } from '~/helpers/paymentHelpers';

@Injectable()
export class WorkspacesService extends WorkspacesServiceEE {
  constructor(
    protected appHooksService: AppHooksService,
    protected configService: ConfigService<AppConfig>,
    protected basesService: BasesService,
    protected tablesService: TablesService,
    @Inject(forwardRef(() => 'JobsService')) protected jobsService,
    protected paymentService: PaymentService,
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

  /**
   * Override workspace list for on-prem.
   * Super admin sees ALL workspaces as owner (unconditional — both CE and EE).
   * Regular users: EE workspace listing (role inheritance).
   * If user has no workspace membership, lazily add them to the default workspace
   * with NO_ACCESS (they must be explicitly invited to bases).
   */
  async list(param: {
    user: {
      id: string;
      roles?: string;
      extra?: Record<string, any>;
    };
    req: NcRequest;
  }) {
    // Super admin sees all workspaces unconditionally
    const isSuperAdmin = extractRolesObj(param.user?.roles)?.[
      OrgUserRoles.SUPER_ADMIN
    ];

    if (isSuperAdmin) {
      const allWorkspaces = await Workspace.list();
      const workspacesWithRoles = allWorkspaces.map((ws) => ({
        ...ws,
        roles: WorkspaceUserRoles.OWNER,
      }));

      return new PagedResponseImpl(workspacesWithRoles, {
        count: workspacesWithRoles.length,
      });
    }

    // Check if user already has workspace membership
    const workspaces = await WorkspaceUser.workspaceList({
      fk_user_id: param.user.id,
    });

    if (workspaces.length) {
      return new PagedResponseImpl(workspaces, {
        count: workspaces.length,
      });
    }

    // User has no workspaces — lazily add them to the default workspace with NO_ACCESS
    if (param.req.user?.id) {
      await verifyDefaultWorkspace(undefined, Noco.ncMeta);
      await verifyDefaultWsOwner(Noco.ncMeta);

      if (Noco.ncDefaultWorkspaceId) {
        try {
          await WorkspaceUser.insert({
            fk_workspace_id: Noco.ncDefaultWorkspaceId,
            fk_user_id: param.user.id,
            roles: WorkspaceUserRoles.NO_ACCESS,
          });
          this.logger.log(
            `Added user ${param.user.id} to default workspace as NO_ACCESS`,
          );
        } catch (e) {
          // User might already exist in workspace (race condition)
          this.logger.warn(
            `Failed to add user to default workspace: ${e.message}`,
          );
        }

        const updatedWorkspaces = await WorkspaceUser.workspaceList({
          fk_user_id: param.user.id,
        });

        return new PagedResponseImpl(updatedWorkspaces, {
          count: updatedWorkspaces.length,
        });
      }
    }

    // Fallback: no default workspace available
    return new PagedResponseImpl(workspaces, {
      count: workspaces.length,
    });
  }

  /**
   * Override base listing for on-prem.
   * Super admin sees all bases. Regular users use EE workspace role inheritance
   * (migration ensures existing bases stay private via no-access base_user entries).
   */
  async getProjectList(param: {
    user: {
      id: string;
      roles?: string;
    };
    workspaceId: string;
    req: NcRequest;
  }) {
    // Super admin sees all workspace bases
    const isSuperAdmin = extractRolesObj(param.user?.roles)?.[
      OrgUserRoles.SUPER_ADMIN
    ];

    if (isSuperAdmin) {
      const bases = await Base.list(param.workspaceId);
      return new PagedResponseImpl<BaseType>(bases, {
        count: bases.length,
      });
    }

    // Always use EE behavior (workspace role inheritance)
    return super.getProjectList(param);
  }

  async create(param: {
    user: UserType;
    workspaces: WorkspaceType | WorkspaceType[];
    req: NcRequest;
  }) {
    // Check if workspace creation is restricted
    const settings = await Noco.getAppSettings();
    if (settings.restrict_workspace_creation) {
      // Only super admins can create workspaces when restriction is enabled
      const userRoles = extractRolesObj(param.user.roles);
      if (!userRoles[OrgUserRoles.SUPER_ADMIN]) {
        NcError.forbidden(
          'Workspace creation is restricted. Only instance admin can create workspaces.',
        );
      }
    }

    // Org role check: only Admin and Creator can create workspaces
    // Viewer org role cannot create workspaces
    if (Noco.isEE() && Noco.ncDefaultOrgId) {
      const userRoles = extractRolesObj(param.user.roles);
      if (!userRoles[OrgUserRoles.SUPER_ADMIN]) {
        const orgId = Noco.ncDefaultOrgId;
        const orgUser = await Noco.ncMeta
          .knexConnection(MetaTable.ORG_USERS)
          .where('fk_org_id', orgId)
          .where('fk_user_id', param.user.id)
          .where(function () {
            this.where('deleted', false).orWhereNull('deleted');
          })
          .first();

        if (
          orgUser &&
          orgUser.roles === EnterpriseOrgUserRoles.VIEWER
        ) {
          NcError.forbidden(
            'Workspace creation is not allowed for viewer role. Contact your org admin.',
          );
        }
      }
    }

    /*  const userWorkspacesCount = await Workspace.count({
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
    } */

    // Enforce workspace limit from plan meta (unified with other limits)
    const plan = getOnPremPlan();
    const wsLimit = plan?.meta?.[PlanLimitTypes.LIMIT_WORKSPACE];

    if (wsLimit !== undefined && wsLimit !== -1) {
      const workspacesCount = await Workspace.count({ deleted: false });

      if (workspacesCount >= wsLimit) {
        NcError.notAllowed(
          `Maximum workspace limit reached. Please upgrade license to create more workspaces.`,
        );
      }
    }

    return super.create(param);
  }

  public async createDefaultWorkspace(user: User, req: any) {
    // Enforce workspace limit from plan meta (unified with other limits)
    const plan = getOnPremPlan();
    const wsLimit = plan?.meta?.[PlanLimitTypes.LIMIT_WORKSPACE];

    if (wsLimit !== undefined && wsLimit !== -1) {
      const workspacesCount = await Workspace.count({ deleted: false });

      if (workspacesCount >= wsLimit) {
        NcError.maxWorkspaceLimitReached();
      }
    }

    return super.createDefaultWorkspace(user, req);
  }
}
