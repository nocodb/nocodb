import { Module } from '@nestjs/common';
import { DatasService } from '../../services/datas.service';
import { LayoutsService } from './layouts.service';
import { LayoutsController } from './layouts.controller';
import { WidgetsService } from './widgets.service';
import { WidgetsController } from './widgets.controller';
import { DashboardFilterController } from './dashboardFilter.controller';
import { WidgetDataService } from './widgetData.service';
import { DashboardFilterService } from './dashboardFilter.service';

@Module({
  controllers: [
    LayoutsController,
    WidgetsController,
    DashboardFilterController,
  ],
  providers: [
    LayoutsService,
    WidgetsService,
    DatasService,
    WidgetDataService,
    DashboardFilterService,
  ],
})
export class DashboardsModule {}
