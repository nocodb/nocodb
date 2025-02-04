import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { NcApiVersion } from 'nocodb-sdk';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { parseHrtimeToMilliSeconds } from '~/helpers';
import { DataApiLimiterGuard } from '~/guards/data-api-limiter.guard';
import { GlobalGuard } from '~/guards/global/global.guard';
import { TenantContext } from '~/decorators/tenant-context.decorator';
import { NcContext, NcRequest } from '~/interface/config';
import { DataV3Service } from '~/services/v3/data-v3.service';
import { DataTableService } from '~/services/data-table.service';
import {
  PagedResponseImpl,
  PagedResponseV3Impl,
} from '~/helpers/PagedResponse';

@Controller()
@UseGuards(DataApiLimiterGuard, GlobalGuard)
export class Datav3Controller {
  constructor(
    protected readonly dataV3Service: DataV3Service,
    protected readonly dataTableService: DataTableService,
  ) {}

  @Get('/api/v3/tables/:modelId/records')
  @Acl('dataList')
  async dataList(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Res() res: Response,
    @Param('modelId') modelId: string,
    @Query('view_id') viewId: string,
  ) {
    const startTime = process.hrtime();
    const responseData = await this.dataV3Service.dataList(context, {
      query: req.query,
      modelId: modelId,
      viewId: viewId,
      req,
    });
    const elapsedSeconds = parseHrtimeToMilliSeconds(process.hrtime(startTime));
    res.setHeader('xc-db-response', elapsedSeconds);
    res.json(responseData);
  }

  @Post(['/api/v3/tables/:modelId/records'])
  @HttpCode(200)
  @Acl('dataInsert')
  async dataInsert(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('modelId') modelId: string,
    @Query('view_id') viewId: string,
    @Body() body: any,
  ) {
    return await this.dataV3Service.dataInsert(context, {
      modelId: modelId,
      body: body,
      viewId,
      cookie: req,
    });
  }

  @Delete(['/api/v3/tables/:modelId/records'])
  @Acl('dataDelete')
  async dataDelete(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('modelId') modelId: string,
    @Query('view_id') viewId: string,
  ) {
    return await this.dataV3Service.dataDelete(context, {
      modelId: modelId,
      cookie: req,
      viewId,
      body: req.body,
    });
  }

  @Patch(['/api/v3/tables/:modelId/records'])
  @Acl('dataUpdate')
  async dataUpdate(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('modelId') modelId: string,
    @Query('view_id') viewId: string,
  ) {
    return await this.dataV3Service.dataUpdate(context, {
      modelId: modelId,
      body: req.body,
      cookie: req,
      viewId,
    });
  }

  @Get(['/api/v3/tables/:modelId/links/:columnId/records/:rowId'])
  @Acl('nestedDataList')
  async nestedDataList(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('modelId') modelId: string,
    @Query('view_id') viewId: string,
    @Param('columnId') columnId: string,
    @Param('rowId') rowId: string,
  ) {
    const response = await this.dataTableService.nestedDataList(context, {
      modelId,
      rowId: rowId,
      query: req.query,
      viewId,
      columnId,
      apiVersion: NcApiVersion.V3,
    });

    if (!(response instanceof PagedResponseImpl)) {
      return response;
    }

    return new PagedResponseV3Impl(response as PagedResponseImpl<any>, {
      baseUrl: req.baseUrl,
      tableId: modelId,
    });
  }

  @Post(['/api/v3/tables/:modelId/links/:columnId/records/:rowId'])
  @Acl('nestedDataLink')
  async nestedLink(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('modelId') modelId: string,
    @Query('view_id') viewId: string,
    @Param('columnId') columnId: string,
    @Param('rowId') rowId: string,
    @Body()
    refRowIds:
      | string
      | string[]
      | number
      | number[]
      | Record<string, any>
      | Record<string, any>[],
  ) {
    return await this.dataTableService.nestedLink(context, {
      modelId,
      rowId: rowId,
      query: req.query,
      viewId,
      columnId,
      refRowIds,
      cookie: req,
    });
  }

  @Delete(['/api/v3/tables/:modelId/links/:columnId/records/:rowId'])
  @Acl('nestedDataUnlink')
  async nestedUnlink(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('modelId') modelId: string,
    @Query('view_id') viewId: string,
    @Param('columnId') columnId: string,
    @Param('rowId') rowId: string,
    @Body()
    refRowIds: string | string[] | number | number[] | Record<string, any>,
  ) {
    return await this.dataTableService.nestedUnlink(context, {
      modelId,
      rowId: rowId,
      query: req.query,
      viewId,
      columnId,
      refRowIds,
      cookie: req,
    });
  }

  @Get(['/api/v3/tables/:modelId/records/:rowId'])
  @Acl('dataRead')
  async dataRead(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('modelId') modelId: string,
    @Query('view_id') viewId: string,
    @Param('rowId') rowId: string,
  ) {
    return await this.dataTableService.dataRead(context, {
      modelId,
      rowId: rowId,
      query: req.query,
      viewId,
      apiVersion: NcApiVersion.V3,
    });
  }

  @Get(['/api/v3/tables/:modelId/records/count'])
  @Acl('dataCount')
  async dataCount(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Res() res: Response,
    @Param('modelId') modelId: string,
    @Query('view_id') viewId: string,
  ) {
    const countResult = await this.dataTableService.dataCount(context, {
      query: req.query,
      modelId,
      viewId,
      apiVersion: NcApiVersion.V3,
    });

    res.json(countResult);
  }
}
