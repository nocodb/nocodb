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
// import { PageDao } from '~/daos/page.dao';
// import { PageSnapshotDao } from '~/daos/page-snapshot.dao';
// import { DocsPagesHistoryController } from '~/controllers/docs/docs-pages-history.controller';
// import { DocsPagesController } from '~/controllers/docs/docs-pages.controller';
// import { DocsPageHistoryService } from '~/services/docs/history/docs-page-history.service';
// import { WidgetDataService } from '~/services/dashboards/widgetData.service';
// import { WidgetsService } from '~/services/dashboards/widgets.service';
// import { LayoutsService } from '~/services/dashboards/layouts.service';
// import { LayoutFilterService } from '~/services/dashboards/layoutFilter.service';

// import { WidgetsController } from '~/controllers/dashboards/widgets.controller';
// import { LayoutsController } from '~/controllers/dashboards/layouts.controller';
// import { LayoutFilterController } from '~/controllers/dashboards/layoutFilter.controller';
import { TelemetryController } from '~/controllers/telemetry.controller';

// import { DocsPagesService } from '~/services/docs/docs-pages.service';
// import { DocsPagesUpdateService } from '~/services/docs/docs-page-update.service';
// import { DocsPublicController } from '~/controllers/docs/public/docs-public.controller';
// import { PublicDocsService } from '~/services/docs/public/public-docs.service';
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

    /** DAOs */
    // PageDao,
    // PageSnapshotDao,
    /** Docs Services */
    // DocsPageHistoryService,
    // DocsPagesService,
    // DocsPagesUpdateService,
    // PublicDocsService,
    /** Layouts Services */
    // WidgetDataService,
    // WidgetsService,
    // LayoutsService,
    // LayoutFilterService,

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
    // DocsPagesHistoryController,
    // DocsPagesController,
    // DocsPublicController,
    // WidgetsController,
    // LayoutsController,
    // LayoutFilterController,

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
