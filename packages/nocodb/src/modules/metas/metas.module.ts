import { forwardRef, Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import multer from 'multer';
import { GlobalModule } from '~/modules/global/global.module';
import { NC_ATTACHMENT_FIELD_SIZE } from '~/constants';
import { ApiDocsController } from '~/controllers/api-docs/api-docs.controller';
import { ApiTokensController } from '~/controllers/api-tokens.controller';
import { AttachmentsController } from '~/controllers/attachments.controller';
import { AttachmentsSecureController } from '~/controllers/attachments-secure.controller';
import { AuditsController } from '~/controllers/audits.controller';
import { SourcesController } from '~/controllers/sources.controller';
import { CachesController } from '~/controllers/caches.controller';
import { ColumnsController } from '~/controllers/columns.controller';
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
import { BulkDataAliasService } from '~/services/bulk-data-alias.service';
import { CachesService } from '~/services/caches.service';
import { ColumnsService } from '~/services/columns.service';
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
import { NotificationsService } from '~/services/notifications.service';
import { NotificationsController } from '~/controllers/notifications.controller';
import { NotificationsGateway } from '~/gateways/notifications/notifications.gateway';

export const metaModuleMetadata = {
  imports: [
    MulterModule.register({
      storage: multer.diskStorage({}),
      limits: {
        fieldSize: NC_ATTACHMENT_FIELD_SIZE,
      },
    }),
    forwardRef(() => GlobalModule),
  ],
  controllers: [
    ...(process.env.NC_WORKER_CONTAINER !== 'true'
      ? [
          ApiDocsController,
          ApiTokensController,
          ...(process.env.NC_SECURE_ATTACHMENTS === 'true'
            ? [AttachmentsSecureController]
            : [AttachmentsController]),
          AuditsController,
          SourcesController,
          CachesController,
          ColumnsController,
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
        ]
      : []),
  ],
  providers: [
    /** Services */
    ApiDocsService,
    ApiTokensService,
    AttachmentsService,
    AuditsService,
    SourcesService,
    CachesService,
    ColumnsService,
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
    BulkDataAliasService,
    NotificationsService,
    NotificationsGateway,
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
    BasesService,
    AttachmentsService,
    BaseUsersService,
    HooksService,
    MetaDiffsService,
    BasesService,
    SourcesService,
    UtilsService,
  ],
};

@Module(metaModuleMetadata)
export class MetasModule {}
