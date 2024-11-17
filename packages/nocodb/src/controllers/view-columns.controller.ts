import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { APIContext, ViewColumnReqType } from 'nocodb-sdk';
import type {
  CalendarColumnReqType,
  FormColumnReqType,
  GalleryColumnReqType,
  GridColumnReqType,
  KanbanColumnReqType,
} from 'nocodb-sdk';
import { GlobalGuard } from '~/guards/global/global.guard';
import { PagedResponseImpl } from '~/helpers/PagedResponse';
import { ViewColumnsService } from '~/services/view-columns.service';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { TenantContext } from '~/decorators/tenant-context.decorator';
import { NcContext, NcRequest } from '~/interface/config';

@Controller()
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class ViewColumnsController {
  constructor(private readonly viewColumnsService: ViewColumnsService) {}

  @Get([
    '/api/v1/db/meta/views/:viewId/columns/',
    '/api/v2/meta/views/:viewId/columns/',
  ])
  @Acl('columnList')
  async columnList(
    @TenantContext() context: NcContext,
    @Param('viewId') viewId: string,
  ) {
    return new PagedResponseImpl(
      await this.viewColumnsService.columnList(context, {
        viewId,
      }),
    );
  }

  @Post([
    '/api/v1/db/meta/views/:viewId/columns/',
    '/api/v2/meta/views/:viewId/columns/',
  ])
  @HttpCode(200)
  @Acl('columnAdd')
  async columnAdd(
    @TenantContext() context: NcContext,
    @Param('viewId') viewId: string,
    @Body() body: ViewColumnReqType,
    @Req() req: NcRequest,
  ) {
    const viewColumn = await this.viewColumnsService.columnAdd(context, {
      viewId,
      column: body,
      req,
    });
    return viewColumn;
  }

  @Patch([
    '/api/v1/db/meta/views/:viewId/columns/:columnId',
    '/api/v2/meta/views/:viewId/columns/:columnId',
  ])
  @Acl('viewColumnUpdate')
  async viewColumnUpdate(
    @TenantContext() context: NcContext,
    @Param('viewId') viewId: string,
    @Param('columnId') columnId: string,
    @Body() body: ViewColumnReqType,
    @Req() req: NcRequest,
  ) {
    const result = await this.viewColumnsService.columnUpdate(context, {
      viewId,
      columnId,
      column: body,
      req,
    });
    return result;
  }

  @Patch('/api/v3/meta/views/:viewId/columns')
  @Acl('columnUpdate')
  async viewColumnUpdateV3(
    @TenantContext() context: NcContext,
    @Req() req,
    @Param('viewId') viewId: string,
    @Body()
    body:
      | GridColumnReqType
      | GalleryColumnReqType
      | KanbanColumnReqType
      | FormColumnReqType
      | CalendarColumnReqType[]
      | Record<
          APIContext.VIEW_COLUMNS,
          Record<
            string,
            | GridColumnReqType
            | GalleryColumnReqType
            | KanbanColumnReqType
            | FormColumnReqType
            | CalendarColumnReqType
          >
        >,
  ) {
    return new PagedResponseImpl(
      await this.viewColumnsService.columnsUpdate(context, {
        viewId,
        columns: body,
        req,
      }),
    );
  }

  @Get('/api/v3/meta/views/:viewId/columns')
  @Acl('columnList')
  async viewColumnListV3(
    @TenantContext() context: NcContext,
    @Req() req,
    @Param('viewId') viewId: string,
  ) {
    return {
      [APIContext.VIEW_COLUMNS]: await this.viewColumnsService.viewColumnList(
        context,
        {
          viewId,
          req,
        },
      ),
    };
  }
}
