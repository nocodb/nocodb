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

/* Datas */
import { DataOptService } from '~/services/data-opt/data-opt.service';

/* Workspaces */
import { WorkspacesService } from '~/services/workspaces.service';
import { WorkspacesController } from '~/controllers/workspaces.controller';
import { WorkspaceUsersService } from '~/services/workspace-users.service';
import { WorkspaceUsersController } from '~/controllers/workspace-users.controller';

/* Snapshot */
import { SnapshotController } from '~/controllers/snapshot.controller';
import { SnapshotService } from '~/services/snapshot.service';

/* Scripts */
import { ScriptsService } from '~/services/scripts.service';

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

    /* Workspaces */
    WorkspacesService,
    WorkspaceUsersService,

    /* Snapshot */
    SnapshotService,

    /* Scripts */
    ScriptsService,
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

    /* Workspaces */
    WorkspacesController,
    WorkspaceUsersController,

    /* Snapshot */
    SnapshotController,

    ...nocoModuleMetadata.controllers,
  ],
  exports: [
    ...nocoModuleMetadata.exports,

    /* Generic */
    CustomUrlsService,

    /* Workspaces */
    WorkspacesService,
    WorkspaceUsersService,
  ],
};

@Module(nocoModuleEeMetadata)
export class NocoModule {}
