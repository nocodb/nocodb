import { Module } from '@nestjs/common';

/* Modules */
import { MulterModule } from '@nestjs/platform-express';
import multer from 'multer';
// import { NotFoundHandlerModule } from './not-found-handler.module';
import { EventEmitterModule } from '~/modules/event-emitter/event-emitter.module';
import { JobsModule } from '~/modules/jobs/jobs.module';

/* Generic */
import { GlobalGuard } from '~/guards/global/global.guard';
import { InitMetaServiceProvider } from '~/providers/init-meta-service.provider';
import { JwtStrategyProvider } from '~/providers/jwt-strategy.provider';
import { AppHooksListenerService } from '~/services/app-hooks-listener.service';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { HookHandlerService } from '~/services/hook-handler.service';
import { MailService } from '~/services/mail/mail.service';
import { TelemetryService } from '~/services/telemetry.service';
import { JwtStrategy } from '~/strategies/jwt.strategy';
import { RealtimeService } from '~/meta/realtime.service';
/* User */
import { UsersController } from '~/controllers/users/users.controller';
import { UsersService } from '~/services/users/users.service';

/* Metas */
import {
  NC_ATTACHMENT_FIELD_SIZE,
  NC_MAX_ATTACHMENTS_ALLOWED,
  NC_NON_ATTACHMENT_FIELD_SIZE,
} from '~/constants';
import { ApiDocsController } from '~/controllers/api-docs/api-docs.controller';
import { ApiTokensController } from '~/controllers/api-tokens.controller';
import { AttachmentsSecureController } from '~/controllers/attachments-secure.controller';
import { AttachmentsController } from '~/controllers/attachments.controller';
import { AuditsController } from '~/controllers/audits.controller';
import { BaseUsersController } from '~/controllers/base-users.controller';
import { BasesController } from '~/controllers/bases.controller';
import { CachesController } from '~/controllers/caches.controller';
import { CalendarsController } from '~/controllers/calendars.controller';
import { ColumnsController } from '~/controllers/columns.controller';
import { CommandPaletteController } from '~/controllers/command-palette.controller';
import { CommentsController } from '~/controllers/comments.controller';
import { ExtensionsController } from '~/controllers/extensions.controller';
import { FiltersController } from '~/controllers/filters.controller';
import { FormColumnsController } from '~/controllers/form-columns.controller';
import { FormsController } from '~/controllers/forms.controller';
import { GalleriesController } from '~/controllers/galleries.controller';
import { GridColumnsController } from '~/controllers/grid-columns.controller';
import { GridsController } from '~/controllers/grids.controller';
import { HooksController } from '~/controllers/hooks.controller';
import { JobsMetaController } from '~/controllers/jobs-meta.controller';
import { KanbansController } from '~/controllers/kanbans.controller';
import { MapsController } from '~/controllers/maps.controller';
import { MetaDiffsController } from '~/controllers/meta-diffs.controller';
import { ModelVisibilitiesController } from '~/controllers/model-visibilities.controller';
import { NotificationsController } from '~/controllers/notifications.controller';
import { OrgLcenseController } from '~/controllers/org-lcense.controller';
import { OrgTokensController } from '~/controllers/org-tokens.controller';
import { OrgUsersController } from '~/controllers/org-users.controller';
import { PluginsController } from '~/controllers/plugins.controller';
import { PublicMetasController } from '~/controllers/public-metas.controller';
import { SharedBasesController } from '~/controllers/shared-bases.controller';
import { SortsController } from '~/controllers/sorts.controller';
import { SourcesController } from '~/controllers/sources.controller';
import { SyncController } from '~/controllers/sync.controller';
import { TablesController } from '~/controllers/tables.controller';
import { UtilsController } from '~/controllers/utils.controller';
import { ViewColumnsController } from '~/controllers/view-columns.controller';
import { ViewsController } from '~/controllers/views.controller';
import { MetaService } from '~/meta/meta.service';
import { ApiDocsService } from '~/services/api-docs/api-docs.service';
import { ApiTokensService } from '~/services/api-tokens.service';
import { AttachmentsService } from '~/services/attachments.service';
import { AuditsService } from '~/services/audits.service';
import { BaseUsersService } from '~/services/base-users/base-users.service';
import { BasesService } from '~/services/bases.service';
import { CachesService } from '~/services/caches.service';
import { CalendarsService } from '~/services/calendars.service';
import { ColumnsService } from '~/services/columns.service';
import { CommandPaletteService } from '~/services/command-palette.service';
import { CommentsService } from '~/services/comments.service';
import { ExtensionsService } from '~/services/extensions.service';
import { FiltersService } from '~/services/filters.service';
import { FormColumnsService } from '~/services/form-columns.service';
import { FormsService } from '~/services/forms.service';
import { GalleriesService } from '~/services/galleries.service';
import { GridColumnsService } from '~/services/grid-columns.service';
import { GridsService } from '~/services/grids.service';
import { HooksService } from '~/services/hooks.service';
import { JobsMetaService } from '~/services/jobs-meta.service';
import { KanbansService } from '~/services/kanbans.service';
import { MapsService } from '~/services/maps.service';
import { MetaDiffsService } from '~/services/meta-diffs.service';
import { ModelVisibilitiesService } from '~/services/model-visibilities.service';
import { NocoJobsService } from '~/services/noco-jobs.service';
import { NotificationsService } from '~/services/notifications/notifications.service';
import { OrgLcenseService } from '~/services/org-lcense.service';
import { OrgTokensEeService } from '~/services/org-tokens-ee.service';
import { OrgTokensService } from '~/services/org-tokens.service';
import { OrgUsersService } from '~/services/org-users.service';
import { PluginsService } from '~/services/plugins.service';
import { PublicMetasService } from '~/services/public-metas.service';
import { SharedBasesService } from '~/services/shared-bases.service';
import { SortsService } from '~/services/sorts.service';
import { SourcesService } from '~/services/sources.service';
import { SyncService } from '~/services/sync.service';
import { TablesService } from '~/services/tables.service';
import { UtilsService } from '~/services/utils.service';
import { ViewColumnsService } from '~/services/view-columns.service';
import { ViewsService } from '~/services/views.service';
import { McpTokenService } from '~/services/mcp.service';
import { McpService } from '~/mcp/mcp.service';
import { McpController } from '~/mcp/mcp.controller';
import { InternalController } from '~/controllers/internal.controller';

/* Datas */
import { BulkDataAliasController } from '~/controllers/bulk-data-alias.controller';
import { CalendarDatasController } from '~/controllers/calendars-datas.controller';
import { DataAliasNestedController } from '~/controllers/data-alias-nested.controller';
import { DataAliasController } from '~/controllers/data-alias.controller';
import { DataTableController } from '~/controllers/data-table.controller';
import { DatasController } from '~/controllers/datas.controller';
import { IntegrationsController } from '~/controllers/integrations.controller';
import { OldDatasController } from '~/controllers/old-datas/old-datas.controller';
import { OldDatasService } from '~/controllers/old-datas/old-datas.service';
import { PublicDatasController } from '~/controllers/public-datas.controller';
import { RealtimeController } from '~/controllers/realtime.controller';
import { BaseUsersV3Controller } from '~/controllers/v3/base-users-v3.controller';
import { BasesV3Controller } from '~/controllers/v3/bases-v3.controller';
import { ColumnsV3Controller } from '~/controllers/v3/columns-v3.controller';
import { Datav3Controller } from '~/controllers/v3/data-v3.controller';
import { FiltersV3Controller } from '~/controllers/v3/filters-v3.controller';
import { SortsV3Controller } from '~/controllers/v3/sorts-v3.controller';
import { TablesV3Controller } from '~/controllers/v3/tables-v3.controller';
import { ViewsV3Controller } from '~/controllers/v3/views-v3.controller';
import { BulkDataAliasService } from '~/services/bulk-data-alias.service';
import { CalendarDatasService } from '~/services/calendar-datas.service';
import { DataAliasNestedService } from '~/services/data-alias-nested.service';
import { DataTableService } from '~/services/data-table.service';
import { DatasService } from '~/services/datas.service';
import { FormulaColumnTypeChanger } from '~/services/formula-column-type-changer.service';
import { IntegrationsService } from '~/services/integrations.service';
import { PublicDatasExportService } from '~/services/public-datas-export.service';
import { PublicDatasService } from '~/services/public-datas.service';
import { BaseUsersV3Service } from '~/services/v3/base-users-v3.service';
import { BasesV3Service } from '~/services/v3/bases-v3.service';
import { ColumnsV3Service } from '~/services/v3/columns-v3.service';
import { DataV3Service } from '~/services/v3/data-v3.service';
import { FiltersV3Service } from '~/services/v3/filters-v3.service';
import { SortsV3Service } from '~/services/v3/sorts-v3.service';
import { TablesV3Service } from '~/services/v3/tables-v3.service';
import { ViewsV3Service } from '~/services/v3/views-v3.service';

/* ACL */
import { AclMiddleware } from '~/middlewares/extract-ids/extract-ids.middleware';

export const nocoModuleMetadata = {
  imports: [
    EventEmitterModule,
    JobsModule,
    MulterModule.register({
      storage: multer.diskStorage({}),
      limits: {
        fieldSize: NC_NON_ATTACHMENT_FIELD_SIZE,
        fileSize: NC_ATTACHMENT_FIELD_SIZE,
        files: NC_MAX_ATTACHMENTS_ALLOWED,
      },
    }),

    // put it at the bottom most since it's route not found handling
    // resorting to import to be resolved the last
    // NotFoundHandlerModule,
  ],
  controllers: [
    ...(process.env.NC_WORKER_CONTAINER !== 'true'
      ? [
          /* Users */
          UsersController,

          /* Metas */
          ApiDocsController,
          ApiTokensController,
          ...(process.env.NC_SECURE_ATTACHMENTS === 'true'
            ? [AttachmentsSecureController]
            : [AttachmentsController]),
          AuditsController,
          SourcesController,
          CachesController,
          CalendarsController,
          ColumnsController,
          CommentsController,
          FiltersController,
          FormColumnsController,
          FormsController,
          GalleriesController,
          GridColumnsController,
          GridsController,
          HooksController,
          KanbansController,
          MapsController,
          MetaDiffsController,
          ModelVisibilitiesController,
          OrgLcenseController,
          OrgTokensController,
          OrgUsersController,
          PluginsController,
          BaseUsersController,
          BaseUsersV3Controller,
          BasesController,
          PublicMetasController,
          ViewsController,
          ViewColumnsController,
          UtilsController,
          TablesController,
          SyncController,
          SortsController,
          SharedBasesController,
          NotificationsController,
          CommandPaletteController,
          ExtensionsController,
          JobsMetaController,
          IntegrationsController,
          InternalController,

          // MCP
          McpController,
          RealtimeController,

          /* V3 APIs */
          BasesV3Controller,
          TablesV3Controller,
          ColumnsV3Controller,
          SortsV3Controller,
          ViewsV3Controller,
          FiltersV3Controller,

          /* Datas */
          DataTableController,
          DatasController,
          CalendarDatasController,
          BulkDataAliasController,
          DataAliasController,
          DataAliasNestedController,
          OldDatasController,
          PublicDatasController,
          Datav3Controller,
        ]
      : []),
  ],
  providers: [
    /* Generic */
    InitMetaServiceProvider,
    JwtStrategyProvider,
    GlobalGuard,
    AppHooksService,
    AppHooksListenerService,
    TelemetryService,
    HookHandlerService,
    MailService,
    RealtimeService,

    AclMiddleware,

    /* Users */
    UsersService,

    /* Metas */
    ApiDocsService,
    ApiTokensService,
    AttachmentsService,
    AuditsService,
    SourcesService,
    CachesService,
    CalendarsService,
    ColumnsService,
    CommentsService,
    FiltersService,
    FormColumnsService,
    FormsService,
    GalleriesService,
    GridColumnsService,
    GridsService,
    HooksService,
    KanbansService,
    MapsService,
    MetaDiffsService,
    ModelVisibilitiesService,
    OrgLcenseService,
    OrgTokensEeService,
    OrgTokensService,
    OrgUsersService,
    PluginsService,
    BaseUsersService,
    BaseUsersV3Service,
    BasesService,
    PublicMetasService,
    ViewsService,
    ViewColumnsService,
    UtilsService,
    TablesService,
    SyncService,
    SortsService,
    SharedBasesService,
    NotificationsService,
    CommandPaletteService,
    ExtensionsService,
    JobsMetaService,
    IntegrationsService,
    BasesV3Service,
    TablesV3Service,
    ColumnsV3Service,
    SortsV3Service,
    ViewsV3Service,
    FiltersV3Service,
    NocoJobsService,
    McpTokenService,
    McpService,
    /* Datas */
    DataTableService,
    DatasService,
    BulkDataAliasService,
    DataAliasNestedService,
    CalendarDatasService,
    OldDatasService,
    PublicDatasService,
    PublicDatasExportService,
    DataV3Service,

    // use custom provider to avoid circular dependency
    {
      provide: 'FormulaColumnTypeChanger',
      useClass: FormulaColumnTypeChanger,
    },
  ],
  exports: [
    /* Generic */
    AppHooksService,
    TelemetryService,
    HookHandlerService,
    JwtStrategy,

    /* Users */
    UsersService,

    /* Metas */
    MetaService,
    TablesService,
    ColumnsService,
    FiltersService,
    SortsService,
    ViewsService,
    ViewColumnsService,
    GridsService,
    CalendarsService,
    GridColumnsService,
    FormsService,
    FormColumnsService,
    GalleriesService,
    KanbansService,
    BasesService,
    AttachmentsService,
    BaseUsersService,
    HooksService,
    MetaDiffsService,
    SourcesService,
    UtilsService,
    IntegrationsService,
    NocoJobsService,

    /* Datas */
    DatasService,
    BulkDataAliasService,
    DataTableService,
    DataV3Service,
  ],
};

@Module(nocoModuleMetadata)
export class NocoModule {}
