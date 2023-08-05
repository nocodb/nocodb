import { Module } from '@nestjs/common';
import { metaModuleMetadata } from 'src/modules/metas/metas.module';
import { PageDao } from '~/daos/page.dao';
import { PageSnapshotDao } from '~/daos/page-snapshot.dao';
import { DocsPagesHistoryController } from '~/controllers/docs/docs-pages-history.controller';
import { DocsPagesController } from '~/controllers/docs/docs-pages.controller';
import { DocsPageHistoryService } from '~/services/docs/history/docs-page-history.service';
import { WidgetDataService } from '~/services/dashboards/widgetData.service';
import { WidgetsService } from '~/services/dashboards/widgets.service';
import { LayoutsService } from '~/services/dashboards/layouts.service';
import { LayoutFilterService } from '~/services/dashboards/layoutFilter.service';

import { WidgetsController } from '~/controllers/dashboards/widgets.controller';
import { LayoutsController } from '~/controllers/dashboards/layouts.controller';
import { LayoutFilterController } from '~/controllers/dashboards/layoutFilter.controller';

// import { PageDao } from '../../daos/page.dao';
import { DocsPagesService } from '~/services/docs/docs-pages.service';
import { DocsPagesUpdateService } from '~/services/docs/docs-page-update.service';
import { DocsPublicController } from '~/controllers/docs/public/docs-public.controller';
import { PublicDocsService } from '~/services/docs/public/public-docs.service';
import { ThrottlerExpiryListenerService } from '~/services/throttler/throttler-expiry-listener.service';
import { CommandPaletteService } from '~/services/command-palette.service';
import { CommandPaletteController } from '~/controllers/command-palette.controller';

import { ClickhouseService } from '~/services/clickhouse/clickhouse.service';
import { NotificationsService } from '~/services/notifications.service';
import { NotificationsController } from '~/controllers/notifications.controller';

// todo: refactor to use config service
const enableThrottler = !!process.env['NC_THROTTLER_REDIS'];

@Module({
  ...metaModuleMetadata,
  providers: [
    /** Services */
    ...metaModuleMetadata.providers,

    /** DAOs */
    PageDao,
    PageSnapshotDao,
    /** Docs Services */
    DocsPageHistoryService,
    DocsPagesService,
    DocsPagesUpdateService,
    PublicDocsService,
    WidgetDataService,
    WidgetsService,
    LayoutsService,
    LayoutFilterService,
    CommandPaletteService,
    ClickhouseService,
    NotificationsService,
    ...(enableThrottler ? [ThrottlerExpiryListenerService] : []),
  ],
  controllers: [
    ...metaModuleMetadata.controllers,

    DocsPagesHistoryController,
    DocsPagesController,
    DocsPublicController,

    WidgetsController,
    LayoutsController,
    LayoutFilterController,

    CommandPaletteController,
    NotificationsController,
  ],
})
export class MetasModule {}
