import { Module } from '@nestjs/common';

/* Modules */
import { MulterModule } from '@nestjs/platform-express';
import multer from 'multer';
import { EventEmitterModule } from '~/modules/event-emitter/event-emitter.module';
import { JobsModule } from '~/modules/jobs/jobs.module';

/* Generic */
import { InitMetaServiceProvider } from '~/providers/init-meta-service.provider';
import { JwtStrategyProvider } from '~/providers/jwt-strategy.provider';
import { JwtStrategy } from '~/strategies/jwt.strategy';
import { SocketGateway } from '~/gateways/socket.gateway';
import { GlobalGuard } from '~/guards/global/global.guard';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { TelemetryService } from '~/services/telemetry.service';
import { AppHooksListenerService } from '~/services/app-hooks-listener.service';
import { HookHandlerService } from '~/services/hook-handler.service';

/* User */
import { UsersController } from '~/controllers/users/users.controller';
import { UsersService } from '~/services/users/users.service';

/* Metas */
import { NC_ATTACHMENT_FIELD_SIZE } from '~/constants';
import { MetaService } from '~/meta/meta.service';
import { ApiDocsController } from '~/controllers/api-docs/api-docs.controller';
import { ApiTokensController } from '~/controllers/api-tokens.controller';
import { AttachmentsController } from '~/controllers/attachments.controller';
import { AttachmentsSecureController } from '~/controllers/attachments-secure.controller';
import { AuditsController } from '~/controllers/audits.controller';
import { SourcesController } from '~/controllers/sources.controller';
import { CachesController } from '~/controllers/caches.controller';
import { CalendarsController } from '~/controllers/calendars.controller';
import { ColumnsController } from '~/controllers/columns.controller';
import { CommentsController } from '~/controllers/comments.controller';
import { FiltersController } from '~/controllers/filters.controller';
import { FormColumnsController } from '~/controllers/form-columns.controller';
import { FormsController } from '~/controllers/forms.controller';
import { GalleriesController } from '~/controllers/galleries.controller';
import { GridColumnsController } from '~/controllers/grid-columns.controller';
import { GridsController } from '~/controllers/grids.controller';
import { HooksController } from '~/controllers/hooks.controller';
import { KanbansController } from '~/controllers/kanbans.controller';
import { MapsController } from '~/controllers/maps.controller';
import { MetaDiffsController } from '~/controllers/meta-diffs.controller';
import { ModelVisibilitiesController } from '~/controllers/model-visibilities.controller';
import { OrgLcenseController } from '~/controllers/org-lcense.controller';
import { OrgTokensController } from '~/controllers/org-tokens.controller';
import { OrgUsersController } from '~/controllers/org-users.controller';
import { PluginsController } from '~/controllers/plugins.controller';
import { BasesController } from '~/controllers/bases.controller';
import { PublicMetasController } from '~/controllers/public-metas.controller';
import { SharedBasesController } from '~/controllers/shared-bases.controller';
import { SortsController } from '~/controllers/sorts.controller';
import { SyncController } from '~/controllers/sync.controller';
import { TablesController } from '~/controllers/tables.controller';
import { UtilsController } from '~/controllers/utils.controller';
import { ViewColumnsController } from '~/controllers/view-columns.controller';
import { ViewsController } from '~/controllers/views.controller';
import { ApiTokensService } from '~/services/api-tokens.service';
import { AttachmentsService } from '~/services/attachments.service';
import { AuditsService } from '~/services/audits.service';
import { SourcesService } from '~/services/sources.service';
import { CachesService } from '~/services/caches.service';
import { CalendarsService } from '~/services/calendars.service';
import { ColumnsService } from '~/services/columns.service';
import { CommentsService } from '~/services/comments.service';
import { FiltersService } from '~/services/filters.service';
import { FormColumnsService } from '~/services/form-columns.service';
import { FormsService } from '~/services/forms.service';
import { GalleriesService } from '~/services/galleries.service';
import { GridColumnsService } from '~/services/grid-columns.service';
import { GridsService } from '~/services/grids.service';
import { HooksService } from '~/services/hooks.service';
import { KanbansService } from '~/services/kanbans.service';
import { MapsService } from '~/services/maps.service';
import { MetaDiffsService } from '~/services/meta-diffs.service';
import { ModelVisibilitiesService } from '~/services/model-visibilities.service';
import { OrgLcenseService } from '~/services/org-lcense.service';
import { OrgTokensEeService } from '~/services/org-tokens-ee.service';
import { OrgTokensService } from '~/services/org-tokens.service';
import { OrgUsersService } from '~/services/org-users.service';
import { PluginsService } from '~/services/plugins.service';
import { BasesService } from '~/services/bases.service';
import { PublicMetasService } from '~/services/public-metas.service';
import { SharedBasesService } from '~/services/shared-bases.service';
import { SortsService } from '~/services/sorts.service';
import { SyncService } from '~/services/sync.service';
import { TablesService } from '~/services/tables.service';
import { UtilsService } from '~/services/utils.service';
import { ViewColumnsService } from '~/services/view-columns.service';
import { ViewsService } from '~/services/views.service';
import { ApiDocsService } from '~/services/api-docs/api-docs.service';
import { BaseUsersController } from '~/controllers/base-users.controller';
import { BaseUsersService } from '~/services/base-users/base-users.service';
import { NotificationsService } from '~/services/notifications/notifications.service';
import { NotificationsController } from '~/controllers/notifications.controller';
import { CommandPaletteService } from '~/services/command-palette.service';
import { CommandPaletteController } from '~/controllers/command-palette.controller';
import { ExtensionsService } from '~/services/extensions.service';
import { ExtensionsController } from '~/controllers/extensions.controller';
import { JobsMetaService } from '~/services/jobs-meta.service';
import { JobsMetaController } from '~/controllers/jobs-meta.controller';

/* Datas */
import { DataTableController } from '~/controllers/data-table.controller';
import { DataTableService } from '~/services/data-table.service';
import { DataAliasController } from '~/controllers/data-alias.controller';
import { PublicDatasExportController } from '~/controllers/public-datas-export.controller';
import { PublicDatasController } from '~/controllers/public-datas.controller';
import { DatasService } from '~/services/datas.service';
import { DatasController } from '~/controllers/datas.controller';
import { BulkDataAliasController } from '~/controllers/bulk-data-alias.controller';
import { DataAliasExportController } from '~/controllers/data-alias-export.controller';
import { DataAliasNestedController } from '~/controllers/data-alias-nested.controller';
import { OldDatasController } from '~/controllers/old-datas/old-datas.controller';
import { BulkDataAliasService } from '~/services/bulk-data-alias.service';
import { DataAliasNestedService } from '~/services/data-alias-nested.service';
import { OldDatasService } from '~/controllers/old-datas/old-datas.service';
import { PublicDatasExportService } from '~/services/public-datas-export.service';
import { PublicDatasService } from '~/services/public-datas.service';
import { CalendarDatasController } from '~/controllers/calendars-datas.controller';
import { CalendarDatasService } from '~/services/calendar-datas.service';
import { IntegrationsController } from '~/controllers/integrations.controller';
import { IntegrationsService } from '~/services/integrations.service';

export const nocoModuleMetadata = {
  imports: [
    EventEmitterModule,
    JobsModule,
    MulterModule.register({
      storage: multer.diskStorage({}),
      limits: {
        fieldSize: NC_ATTACHMENT_FIELD_SIZE,
      },
    }),
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

          /* Datas */
          DataTableController,
          DatasController,
          CalendarDatasController,
          BulkDataAliasController,
          DataAliasController,
          DataAliasNestedController,
          DataAliasExportController,
          OldDatasController,
          PublicDatasController,
          PublicDatasExportController,
        ]
      : []),
  ],
  providers: [
    /* Generic */
    InitMetaServiceProvider,
    JwtStrategyProvider,
    GlobalGuard,
    SocketGateway,
    AppHooksService,
    AppHooksListenerService,
    TelemetryService,
    HookHandlerService,

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

    /* Datas */
    DataTableService,
    DatasService,
    BulkDataAliasService,
    DataAliasNestedService,
    CalendarDatasService,
    OldDatasService,
    PublicDatasService,
    PublicDatasExportService,
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

    /* Datas */
    DatasService,
    BulkDataAliasService,
  ],
};

@Module(nocoModuleMetadata)
export class NocoModule {}
