import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import multer from 'multer';
import { WidgetDataService } from '../../services/dashboards/widgetData.service';
import { WidgetsService } from '../../services/dashboards/widgets.service';
import { LayoutsService } from '../../services/dashboards/layouts.service';
import { WidgetsController } from '../../controllers/dashboards/widgets.controller';
import { LayoutsController } from '../../controllers/dashboards/layouts.controller';
import { DocsPagesHistoryController } from '../../controllers/docs/docs-pages-history.controller';
import { DocsPagesController } from '../../controllers/docs/docs-pages.controller';
import { DocsPageHistoryService } from '../../services/docs/history/docs-page-history.service';
import { PageDao } from '../../daos/page.dao';
import { DocsPagesService } from '../../services/docs/docs-pages.service';
import { DocsPagesUpdateService } from '../../services/docs/docs-page-update.service';
import { DocsPublicController } from '../../controllers/docs/public/docs-public.controller';
import { PublicDocsService } from '../../services/docs/public/public-docs.service';
import { PageSnapshotDao } from '../../daos/page-snapshot.dao';
import { NC_ATTACHMENT_FIELD_SIZE } from '../../constants';
import { ApiDocsController } from '../../controllers/api-docs/api-docs.controller';
import { ApiTokensController } from '../../controllers/api-tokens.controller';
import { AttachmentsController } from '../../controllers/attachments.controller';
import { AuditsController } from '../../controllers/audits.controller';
import { BasesController } from '../../controllers/bases.controller';
import { CachesController } from '../../controllers/caches.controller';
import { ColumnsController } from '../../controllers/columns.controller';
import { FiltersController } from '../../controllers/filters.controller';
import { FormColumnsController } from '../../controllers/form-columns.controller';
import { FormsController } from '../../controllers/forms.controller';
import { GalleriesController } from '../../controllers/galleries.controller';
import { GridColumnsController } from '../../controllers/grid-columns.controller';
import { GridsController } from '../../controllers/grids.controller';
import { HooksController } from '../../controllers/hooks.controller';
import { KanbansController } from '../../controllers/kanbans.controller';
import { MapsController } from '../../controllers/maps.controller';
import { MetaDiffsController } from '../../controllers/meta-diffs.controller';
import { ModelVisibilitiesController } from '../../controllers/model-visibilities.controller';
import { OrgLcenseController } from '../../controllers/org-lcense.controller';
import { OrgTokensController } from '../../controllers/org-tokens.controller';
import { OrgUsersController } from '../../controllers/org-users.controller';
import { PluginsController } from '../../controllers/plugins.controller';
import { ProjectsController } from '../../controllers/projects.controller';
import { PublicMetasController } from '../../controllers/public-metas.controller';
import { SharedBasesController } from '../../controllers/shared-bases.controller';
import { SortsController } from '../../controllers/sorts.controller';
import { SyncController } from '../../controllers/sync.controller';
import { TablesController } from '../../controllers/tables.controller';
import { UtilsController } from '../../controllers/utils.controller';
import { ViewColumnsController } from '../../controllers/view-columns.controller';
import { ViewsController } from '../../controllers/views.controller';
import { ExtractProjectIdMiddleware } from '../../middlewares/extract-project-id/extract-project-id.middleware';
import { ApiTokensService } from '../../services/api-tokens.service';
import { AttachmentsService } from '../../services/attachments.service';
import { AuditsService } from '../../services/audits.service';
import { BasesService } from '../../services/bases.service';
import { BulkDataAliasService } from '../../services/bulk-data-alias.service';
import { CachesService } from '../../services/caches.service';
import { ColumnsService } from '../../services/columns.service';
import { FiltersService } from '../../services/filters.service';
import { FormColumnsService } from '../../services/form-columns.service';
import { FormsService } from '../../services/forms.service';
import { GalleriesService } from '../../services/galleries.service';
import { GridColumnsService } from '../../services/grid-columns.service';
import { GridsService } from '../../services/grids.service';
import { HooksService } from '../../services/hooks.service';
import { KanbansService } from '../../services/kanbans.service';
import { MapsService } from '../../services/maps.service';
import { MetaDiffsService } from '../../services/meta-diffs.service';
import { ModelVisibilitiesService } from '../../services/model-visibilities.service';
import { OrgLcenseService } from '../../services/org-lcense.service';
import { OrgTokensEeService } from '../../services/org-tokens-ee.service';
import { OrgTokensService } from '../../services/org-tokens.service';
import { OrgUsersService } from '../../services/org-users.service';
import { PluginsService } from '../../services/plugins.service';
import { ProjectsService } from '../../services/projects.service';
import { PublicMetasService } from '../../services/public-metas.service';
import { SharedBasesService } from '../../services/shared-bases.service';
import { SortsService } from '../../services/sorts.service';
import { SyncService } from '../../services/sync.service';
import { TablesService } from '../../services/tables.service';
import { UtilsService } from '../../services/utils.service';
import { ViewColumnsService } from '../../services/view-columns.service';
import { ViewsService } from '../../services/views.service';
import { ApiDocsService } from '../../services/api-docs/api-docs.service';
import { GlobalModule } from '../global/global.module';
import { ProjectUsersController } from '../../controllers/project-users.controller';
import { ProjectUsersService } from '../../services/project-users/project-users.service';
// import { DatasModule } from '../datas/datas.module';
// import { CommandPaletteController } from '../../controllers/command-palette.controller';
// import { CommandPaletteService } from '../../services/command-palette.service';
import { NotificationsController } from '../../controllers/notifications.controller';
import { NotificationsService } from '../../services/notifications.service';
// import { WorkspacesModule } from '../workspaces/workspaces.module';
// import { WorkspaceUsersModule } from '../workspace-users/workspace-users.module';
import { NotificationsGateway } from '../../gateways/notifications/notifications.gateway';
import { ClickhouseService } from '../../services/clickhouse/clickhouse.service';
// import { ThrottlerExpiryListenerService } from '../../services/throttler/throttler-expiry-listener.service';
import { LayoutFilterController } from '../../controllers/dashboards/layoutFilter.controller';
import { LayoutFilterService } from '../../services/dashboards/layoutFilter.service';
import { TelemetryController } from '../../controllers/telemetry.controller';

// todo: refactor to use config service
// const enableThrottler = !!process.env['NC_THROTTLER_REDIS'];

@Module({
  imports: [
    MulterModule.register({
      storage: multer.diskStorage({}),
      limits: {
        fieldSize: NC_ATTACHMENT_FIELD_SIZE,
      },
    }),
    GlobalModule,
    // WorkspacesModule,
    // WorkspaceUsersModule,
  ],
  controllers: [
    ...(process.env.NC_WORKER_CONTAINER !== 'true'
      ? [
          ApiDocsController,
          ApiTokensController,
          AttachmentsController,
          AuditsController,
          BasesController,
          CachesController,
          ColumnsController,
          LayoutFilterController,
          FiltersController,
          FormColumnsController,
          FormsController,
          GalleriesController,
          GridColumnsController,
          GridsController,
          HooksController,
          KanbansController,
          LayoutsController,
          MapsController,
          MetaDiffsController,
          ModelVisibilitiesController,
          OrgLcenseController,
          OrgTokensController,
          OrgUsersController,
          PluginsController,
          ProjectUsersController,
          ProjectsController,
          PublicMetasController,
          ViewsController,
          ViewColumnsController,
          WidgetsController,
          UtilsController,
          TablesController,
          SyncController,
          SortsController,
          SharedBasesController,
          // CommandPaletteController,
          NotificationsController,
          DocsPagesHistoryController,
          DocsPagesController,
          DocsPublicController,
          TelemetryController,
        ]
      : []),
  ],
  providers: [
    /** DAOs */
    PageDao,
    PageSnapshotDao,
    /** Services */
    ApiDocsService,
    ApiTokensService,
    AttachmentsService,
    AuditsService,
    BasesService,
    CachesService,
    ColumnsService,
    LayoutFilterService,
    FiltersService,
    FormColumnsService,
    FormsService,
    GalleriesService,
    GridColumnsService,
    GridsService,
    HooksService,
    KanbansService,
    LayoutsService,
    MapsService,
    MetaDiffsService,
    ModelVisibilitiesService,
    OrgLcenseService,
    OrgTokensEeService,
    OrgTokensService,
    OrgUsersService,
    ProjectUsersService,
    PluginsService,
    ProjectUsersService,
    ProjectsService,
    ExtractProjectIdMiddleware,
    PublicMetasService,
    ViewsService,
    ViewColumnsService,
    WidgetsService,
    WidgetDataService,
    UtilsService,
    TablesService,
    SyncService,
    SortsService,
    SharedBasesService,
    BulkDataAliasService,
    // CommandPaletteService,
    NotificationsService,
    NotificationsGateway,
    ClickhouseService,
    DocsPagesService,
    DocsPageHistoryService,
    DocsPagesUpdateService,
    PublicDocsService,
    // ...(enableThrottler ? [ThrottlerExpiryListenerService] : []),
  ],
  exports: [
    TablesService,
    ColumnsService,
    FiltersService,
    SortsService,
    ViewsService,
    ViewColumnsService,
    GridsService,
    GridColumnsService,
    FormsService,
    FormColumnsService,
    GalleriesService,
    KanbansService,
    ProjectsService,
    AttachmentsService,
    ProjectUsersService,
    HooksService,
  ],
})
export class MetasModule {}
