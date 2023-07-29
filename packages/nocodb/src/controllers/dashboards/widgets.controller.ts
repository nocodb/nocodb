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
import { GlobalGuard } from '../../guards/global/global.guard';
import { WidgetsService } from '~/services/dashboards/widgets.service';
import Widget from '~/models/Widget';
import { PagedResponseImpl } from '~/helpers/PagedResponse';
import {
  ExtractIdsMiddleware,
  UseAclMiddleware,
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
  @UseAclMiddleware({
    permissionName: 'widgetsList',
  })
  async widgetsList(@Param('layoutId') layoutId: string, @Request() req) {
    return new PagedResponseImpl(
      await this.widgetsService.getWidgets({
        layoutId,
      }),
    );
  }

  @Get(['api/v1/layouts/:layoutId/widgets/:widgetId'])
  @UseAclMiddleware({
    permissionName: 'widgetGet',
  })
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
  @UseAclMiddleware({
    permissionName: 'widgetCreate',
  })
  async widgetCreate(
    @Param('layoutId') layoutId: string,
    @Body() body: WidgetReqType,
    @Request() req,
  ) {
    const result = await this.widgetsService.widgetCreate({
      layoutId,
      widgetReq: body,
    });

    return result;
  }

  @Patch(['/api/v1/layouts/:layoutId/widgets/:widgetId'])
  @HttpCode(200)
  @UseAclMiddleware({
    permissionName: 'widgetUpdate',
  })
  async widgetUpdate(
    @Param('layoutId') layoutId: string,
    @Param('widgetId') widgetId: string,
    @Body() body: WidgetUpdateReqType,
    @Request() req,
  ) {
    const result = await this.widgetsService.widgetUpdate({
      widgetId,
      widgetUpdateReq: body,
    });

    return result;
  }

  @Delete(['/api/v1/layouts/:layoutId/widgets/:widgetId'])
  @HttpCode(200)
  @UseAclMiddleware({
    permissionName: 'widgetDelete',
  })
  async widgetDelete(
    @Param('layoutId') layoutId: string,
    @Param('widgetId') widgetId: string,
    @Request() req,
  ) {
    const result = await this.widgetsService.widgetDelete({
      widgetId,
    });

    return result;
  }
}
