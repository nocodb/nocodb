import { WorkspacesService as WorkspacesServiceEE } from 'src/ee/services/workspaces.service';
import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { extractRolesObj, OrgUserRoles, WorkspaceUserRoles } from 'nocodb-sdk';
import type { AppConfig, NcRequest } from '~/interface/config';
import type { BaseType, UserType, WorkspaceType } from 'nocodb-sdk';
import type { User } from '~/models';
import NocoLicense from '~/NocoLicense';
import { TablesService } from '~/services/tables.service';
import { BasesService } from '~/services/bases.service';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { PaymentService } from '~/modules/payment/payment.service';
import { NcError } from '~/helpers/catchError';
import { PagedResponseImpl } from '~/helpers/PagedResponse';
import { Base, BaseUser, Workspace, WorkspaceUser } from '~/models';
import Noco from '~/Noco';
import {
  verifyDefaultWorkspace,
  verifyDefaultWsOwner,
} from '~/helpers/verifyDefaultWorkspace';

@Injectable()
export class WorkspacesService extends WorkspacesServiceEE {
  /**
   * Map org-level roles to workspace-level roles.
   * Used in CE mode to derive workspace ACL from org roles.
   */
  static orgToWsRole(
    roles?: string | Record<string, boolean>,
  ): WorkspaceUserRoles {
    const orgRoles = extractRolesObj(roles);
    if (orgRoles?.[OrgUserRoles.SUPER_ADMIN]) {
      return WorkspaceUserRoles.OWNER;
    }
    if (orgRoles?.[OrgUserRoles.CREATOR]) {
      return WorkspaceUserRoles.CREATOR;
    }
    return WorkspaceUserRoles.VIEWER;
  }

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
   * Override workspace list to handle CE mode (no license).
   * In CE mode, instead of creating a personal workspace for each user,
   * add the user to the shared default workspace.
   * In EE mode, super admin sees ALL workspaces as owner.
   */
  async list(param: {
    user: {
      id: string;
      roles?: string;
      extra?: Record<string, any>;
    };
    req: NcRequest;
  }) {
    // In EE mode (licensed), super admin sees all workspaces
    if (Noco.isEE()) {
      const isSuperAdmin = extractRolesObj(param.user?.roles)?.[
        OrgUserRoles.SUPER_ADMIN
      ];

      if (isSuperAdmin) {
        const allWorkspaces = await Workspace.list();
        // Inject owner role for each workspace
        const workspacesWithRoles = allWorkspaces.map((ws) => ({
          ...ws,
          roles: WorkspaceUserRoles.OWNER,
        }));

        return new PagedResponseImpl(workspacesWithRoles, {
          count: workspacesWithRoles.length,
        });
      }

      return super.list(param);
    }

    // CE mode: ensure default workspace exists and add user to it if needed
    const workspaces = await WorkspaceUser.workspaceList({
      fk_user_id: param.user.id,
    });

    if (workspaces.length) {
      // Sync workspace role from org role (handles admin role changes)
      if (Noco.ncDefaultWorkspaceId) {
        const expectedRole = WorkspacesService.orgToWsRole(param.user.roles);
        const defaultWs = workspaces.find(
          (w) => w.id === Noco.ncDefaultWorkspaceId,
        );
        if (defaultWs && defaultWs.roles !== expectedRole) {
          await WorkspaceUser.update(Noco.ncDefaultWorkspaceId, param.user.id, {
            roles: expectedRole,
          });
          defaultWs.roles = expectedRole;
        }
      }
      return new PagedResponseImpl(workspaces, {
        count: workspaces.length,
      });
    }

    // User has no workspaces — add them to the default workspace
    if (param.req.user?.id) {
      await verifyDefaultWorkspace(undefined, Noco.ncMeta);
      await verifyDefaultWsOwner(Noco.ncMeta);

      if (Noco.ncDefaultWorkspaceId) {
        // Map org role → workspace role so workspace-scoped ACLs match CE behavior
        const wsRole = WorkspacesService.orgToWsRole(param.user.roles);

        try {
          await WorkspaceUser.insert({
            fk_workspace_id: Noco.ncDefaultWorkspaceId,
            fk_user_id: param.user.id,
            roles: wsRole,
          });
          this.logger.log(
            `Added user ${param.user.id} to default workspace as ${wsRole} (CE mode)`,
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
   * Override base listing to use CE access model when unlicensed.
   * CE: only bases with direct project_users entries (BaseUser.getProjectsList)
   * EE: workspace role inheritance gives access to all workspace bases
   * Both modes: super admin sees all bases in any workspace
   */
  async getProjectList(param: {
    user: {
      id: string;
      roles?: string;
    };
    workspaceId: string;
    req: NcRequest;
  }) {
    // Super admin sees all workspace bases in both CE and EE mode
    const isSuperAdmin = extractRolesObj(param.user?.roles)?.[
      OrgUserRoles.SUPER_ADMIN
    ];

    if (isSuperAdmin) {
      const bases = await Base.list(param.workspaceId);
      return new PagedResponseImpl<BaseType>(bases, {
        count: bases.length,
      });
    }

    // In EE mode (licensed), use the standard EE behavior (workspace role inheritance)
    if (Noco.isEE()) {
      return super.getProjectList(param);
    }

    // CE mode: use direct base membership only (matches original CE baseList)
    const bases = await BaseUser.getProjectsList(param.user.id, {});

    return new PagedResponseImpl<BaseType>(bases, {
      count: bases.length,
    });
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

    if (NocoLicense.getWorkspaceLimit()) {
      // get total non-deleted workspaces
      const workspacesCount = await Workspace.count({
        deleted: false,
      });

      if (workspacesCount >= NocoLicense.getWorkspaceLimit()) {
        NcError.notAllowed(
          `Maximum workspace limit reached. Please upgrade license to create more workspaces.`,
        );
      }
    }

    if (NocoLicense.getOneWorkspace()) {
      const firstWorkspace = await Workspace.getFirstWorkspace();
      if (firstWorkspace) {
        NcError.notAllowed('One workspace license allows only one workspace.');
      }
    }

    return super.create(param);
  }

  public async createDefaultWorkspace(user: User, req: any) {
    // check if oneWorkspace enabled and if enabled then allow only one workspace create
    if (NocoLicense.getOneWorkspace()) {
      const firstWorkspace = await Workspace.getFirstWorkspace();
      if (firstWorkspace) {
        return;
      }
    }

    if (NocoLicense.getWorkspaceLimit()) {
      // get total non-deleted workspaces
      const workspacesCount = await Workspace.count({
        deleted: false,
      });

      if (workspacesCount >= NocoLicense.getWorkspaceLimit()) {
        NcError.maxWorkspaceLimitReached();
      }
    }

    return super.createDefaultWorkspace(user, req);
  }
}
