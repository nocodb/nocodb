import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { WidgetReqType, WidgetUpdateReqType } from 'nocodb-sdk';
import { WidgetsService } from '~/services/dashboards/widgets.service';
import Widget from '~/models/Widget';
import { GlobalGuard } from '~/guards/global/global.guard';
import { PagedResponseImpl } from '~/helpers/PagedResponse';
import {
  Acl,
  ExtractIdsMiddleware,
} from '~/middlewares/extract-ids/extract-ids.middleware';
import { WidgetDataService } from '~/services/dashboards/widgetData.service';

@Controller()
@UseGuards(ExtractIdsMiddleware, GlobalGuard)
export class WidgetsController {
  constructor(
    private readonly widgetsService: WidgetsService,
    private readonly widgetDataService: WidgetDataService,
  ) {}

  @Get(['/api/v1/layouts/:layoutId/widgets'])
  @Acl('widgetsList')
  async widgetsList(@Param('layoutId') layoutId: string, @Request() _req) {
    return new PagedResponseImpl(
      await this.widgetsService.getWidgets({
        layoutId,
      }),
    );
  }

  @Get(['api/v1/layouts/:layoutId/widgets/:widgetId'])
  @Acl('widgetGet')
  async widgetGet(
    @Param('layoutId') layoutId: string,
    @Param('widgetId') widgetId: string,
  ) {
    const widgetConfigData = await Widget.get(widgetId);

    const widgetData = await this.widgetDataService.getWidgetData({
      layoutId,
      widgetId,
    });

    return {
      ...widgetConfigData,
      data: widgetData,
    };
  }

  @Post(['/api/v1/layouts/:layoutId/widgets'])
  @HttpCode(200)
  @Acl('widgetCreate')
  async widgetCreate(
    @Param('layoutId') layoutId: string,
    @Body() body: WidgetReqType,
    @Request() _req,
  ) {
    const result = await this.widgetsService.widgetCreate({
      layoutId,
      widgetReq: body,
    });

    return result;
  }

  @Patch(['/api/v1/layouts/:layoutId/widgets/:widgetId'])
  @HttpCode(200)
  @Acl('widgetUpdate')
  async widgetUpdate(
    @Param('layoutId') layoutId: string,
    @Param('widgetId') widgetId: string,
    @Body() body: WidgetUpdateReqType,
    @Request() _req,
  ) {
    const result = await this.widgetsService.widgetUpdate({
      widgetId,
      widgetUpdateReq: body,
    });

    return result;
  }

  @Delete(['/api/v1/layouts/:layoutId/widgets/:widgetId'])
  @HttpCode(200)
  @Acl('widgetDelete')
  async widgetDelete(
    @Param('layoutId') layoutId: string,
    @Param('widgetId') widgetId: string,
    @Request() _req,
  ) {
    const result = await this.widgetsService.widgetDelete({
      widgetId,
    });

    return result;
  }
}
