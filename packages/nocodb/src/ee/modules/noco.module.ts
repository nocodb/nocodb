import { nocoModuleMetadata } from 'src/modules/noco.module';
import { Module } from '@nestjs/common';

import { PaymentModule } from '~/modules/payment/payment.module';

/* Generic */
import { ActionsController } from '~/controllers/actions.controller';
import { CustomUrlsController } from '~/controllers/custom-urls.controller';
import { CustomUrlsService } from '~/services/custom-urls.service';

/* Integrations */
import { NocoAiModule } from '~/integrations/ai/module/ai.module';
import { NocoSyncModule } from '~/integrations/sync/module/sync.module';

/* Metas */
import { OrgWorkspacesService } from '~/services/org-workspaces.service';
import { OrgWorkspacesController } from '~/controllers/org-workspaces.controller';
import { OrgsService } from '~/services/orgs.service';
import { OrgsController } from '~/controllers/orgs.controller';
import { DataReflectionService } from '~/services/data-reflection.service';
import { TelemetryController } from '~/controllers/telemetry.controller';
import { SSOClientService } from '~/services/sso-client.service';
import { SsoClientController } from '~/controllers/sso-client.controller';
import { OrgSSOClientService } from '~/services/org-sso-client.service';
import { PermissionsService } from '~/services/permissions.service';
import { BaseMembersV3Controller } from '~/controllers/v3/base-members-v3.controller';

/* Datas */
import { DataOptService } from '~/services/data-opt/data-opt.service';

/* Workspaces */
import { WorkspacesService } from '~/services/workspaces.service';
import { WorkspacesController } from '~/controllers/workspaces.controller';
import { WorkspaceUsersService } from '~/services/workspace-users.service';
import { WorkspaceUsersController } from '~/controllers/workspace-users.controller';

/* Workspace V3 */
import { WorkspaceV3Service } from '~/ee/services/v3/workspace-v3.service';
import { WorkspaceMembersV3Service } from '~/services/v3/workspace-members-v3.service';
import { WorkspaceV3Controller } from '~/ee/controllers/v3/workspace-v3.controller';
import { WorkspaceMembersV3Controller } from '~/controllers/v3/workspace-members-v3.controller';

/* Snapshot */
import { SnapshotController } from '~/controllers/snapshot.controller';
import { SnapshotService } from '~/services/snapshot.service';

/* Scripts */
import { ScriptsService } from '~/services/scripts.service';

/* Dashboards */
import { DashboardsService } from '~/services/dashboards.service';

import { ActionsService } from '~/services/actions.service';

export const nocoModuleEeMetadata = {
  imports: [
    ...nocoModuleMetadata.imports,
    NocoAiModule,
    NocoSyncModule,
    PaymentModule,
  ],
  providers: [
    ...nocoModuleMetadata.providers,

    /* Generic */
    CustomUrlsService,

    /* Datas */
    DataOptService,

    /* Metas */
    SSOClientService,
    OrgWorkspacesService,
    OrgSSOClientService,
    OrgsService,
    DataReflectionService,
    PermissionsService,
    ViewsV3Service,

    /* Workspaces */
    WorkspacesService,
    WorkspaceUsersService,

    /* Workspace V3 */
    WorkspaceV3Service,
    WorkspaceMembersV3Service,

    /* Snapshot */
    SnapshotService,

    /* Scripts */
    ScriptsService,

    /* Dashboards */
    DashboardsService,

    ActionsService,
  ],
  controllers: [
    ActionsController,

    /* Generic */
    CustomUrlsController,

    /* Metas */
    TelemetryController,
    SsoClientController,

    OrgWorkspacesController,
    OrgsController,

    ViewsV3Controller,

    /* Workspaces */
    WorkspacesController,
    WorkspaceUsersController,

    /* Workspace V3 */
    WorkspaceV3Controller,
    WorkspaceMembersV3Controller,

    /* Snapshot */
    SnapshotController,

    BaseMembersV3Controller,

    ...nocoModuleMetadata.controllers,
  ],
  exports: [
    ...nocoModuleMetadata.exports,
    ScriptsService,
    DashboardsService,
    PermissionsService,
    ActionsService,

    /* Generic */
    CustomUrlsService,

    /* Workspaces */
    WorkspacesService,
    WorkspaceUsersService,

    /* Workspace V3 */
    WorkspaceV3Service,
    WorkspaceMembersV3Service,

    /* Orgs */
    OrgsService,
    OrgWorkspacesService,
  ],
};

@Module(nocoModuleEeMetadata)
export class NocoModule {}
