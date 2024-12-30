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
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { DataTableService } from '~/services/data-table.service';
import { parseHrtimeToMilliSeconds } from '~/helpers';
import { DataApiLimiterGuard } from '~/guards/data-api-limiter.guard';
import { GlobalGuard } from '~/guards/global/global.guard';
import { TenantContext } from '~/decorators/tenant-context.decorator';
import { NcContext, NcRequest } from '~/interface/config';

@Controller()
@UseGuards(DataApiLimiterGuard, GlobalGuard)
export class DataTableController {
  constructor(protected readonly dataTableService: DataTableService) {}

  // todo: Handle the error case where view doesnt belong to model
  @Get('/api/v2/tables/:modelId/records')
  @Acl('dataList')
  async dataList(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Res() res: Response,
    @Param('modelId') modelId: string,
    @Query('viewId') viewId: string,
  ) {
    const startTime = process.hrtime();
    const responseData = await this.dataTableService.dataList(context, {
      query: req.query,
      modelId: modelId,
      viewId: viewId,
    });
    const elapsedSeconds = parseHrtimeToMilliSeconds(process.hrtime(startTime));
    res.setHeader('xc-db-response', elapsedSeconds);
    res.json(responseData);
  }

  @Get(['/api/v2/tables/:modelId/records/count'])
  @Acl('dataCount')
  async dataCount(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Res() res: Response,
    @Param('modelId') modelId: string,
    @Query('viewId') viewId: string,
  ) {
    const countResult = await this.dataTableService.dataCount(context, {
      query: req.query,
      modelId,
      viewId,
    });

    res.json(countResult);
  }

  @Post(['/api/v2/tables/:modelId/records'])
  @HttpCode(200)
  @Acl('dataInsert')
  async dataInsert(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('modelId') modelId: string,
    @Query('viewId') viewId: string,
    @Body() body: any,
    @Query('undo') undo: any,
  ) {
    return await this.dataTableService.dataInsert(context, {
      modelId: modelId,
      body: body,
      viewId,
      cookie: req,
      undo: undo === 'true',
    });
  }

  @Patch(['/api/v2/tables/:modelId/records'])
  @Acl('dataUpdate')
  async dataUpdate(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('modelId') modelId: string,
    @Query('viewId') viewId: string,
    @Param('rowId') _rowId: string,
  ) {
    return await this.dataTableService.dataUpdate(context, {
      modelId: modelId,
      body: req.body,
      cookie: req,
      viewId,
    });
  }

  @Delete(['/api/v2/tables/:modelId/records'])
  @Acl('dataDelete')
  async dataDelete(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('modelId') modelId: string,
    @Query('viewId') viewId: string,
    @Param('rowId') _rowId: string,
  ) {
    return await this.dataTableService.dataDelete(context, {
      modelId: modelId,
      cookie: req,
      viewId,
      body: req.body,
    });
  }

  @Get(['/api/v2/tables/:modelId/aggregate'])
  @Acl('dataAggregate')
  async dataAggregate(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('modelId') modelId: string,
    @Query('viewId') viewId: string,
  ) {
    return await this.dataTableService.dataAggregate(context, {
      query: req.query,
      modelId,
      viewId,
    });
  }

  @Post(['/api/v2/tables/:modelId/bulk/group'])
  @Acl('dataGroupBy')
  async bulkGroupBy(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('modelId') modelId: string,
    @Query('viewId') viewId: string,
  ) {
    return await this.dataTableService.bulkGroupBy(context, {
      query: req.query,
      modelId,
      viewId,
      body: req.body,
    });
  }

  @Post(['/api/v2/tables/:modelId/bulk/datalist'])
  @Acl('dataList')
  async bulkDataList(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('modelId') modelId: string,
    @Query('viewId') viewId: string,
  ) {
    return await this.dataTableService.bulkDataList(context, {
      query: req.query,
      modelId,
      viewId,
      body: req.body,
    });
  }

  @Get(['/api/v2/tables/:modelId/records/:rowId'])
  @Acl('dataRead')
  async dataRead(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('modelId') modelId: string,
    @Query('viewId') viewId: string,
    @Param('rowId') rowId: string,
  ) {
    return await this.dataTableService.dataRead(context, {
      modelId,
      rowId: rowId,
      query: req.query,
      viewId,
    });
  }

  @Post(['/api/v2/tables/:modelId/records/:rowId/move'])
  @Acl('dataUpdate')
  async rowMove(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('modelId') modelId: string,
    @Param('rowId') rowId: string,
    @Query('before') before: string,
  ) {
    return await this.dataTableService.dataMove(context, {
      modelId: modelId,
      rowId: rowId,
      beforeRowId: before,
      cookie: req,
    });
  }

  @Get(['/api/v2/tables/:modelId/links/:columnId/records/:rowId'])
  @Acl('nestedDataList')
  async nestedDataList(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('modelId') modelId: string,
    @Query('viewId') viewId: string,
    @Param('columnId') columnId: string,
    @Param('rowId') rowId: string,
  ) {
    return await this.dataTableService.nestedDataList(context, {
      modelId,
      rowId: rowId,
      query: req.query,
      viewId,
      columnId,
    });
  }

  @Post(['/api/v2/tables/:modelId/links/:columnId/records/:rowId'])
  @Acl('nestedDataLink')
  async nestedLink(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('modelId') modelId: string,
    @Query('viewId') viewId: string,
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

  @Delete(['/api/v2/tables/:modelId/links/:columnId/records/:rowId'])
  @Acl('nestedDataUnlink')
  async nestedUnlink(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('modelId') modelId: string,
    @Query('viewId') viewId: string,
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

  // todo: naming
  @Post(['/api/v2/tables/:modelId/links/:columnId/records'])
  @Acl('nestedDataListCopyPasteOrDeleteAll')
  async nestedListCopyPasteOrDeleteAll(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('modelId') modelId: string,
    @Query('viewId') viewId: string,
    @Param('columnId') columnId: string,
    @Body()
    data: {
      operation: 'copy' | 'paste';
      rowId: string;
      columnId: string;
      fk_related_model_id: string;
    }[],
  ) {
    return await this.dataTableService.nestedListCopyPasteOrDeleteAll(context, {
      modelId,
      query: req.query,
      viewId,
      columnId,
      data,
      cookie: req,
    });
  }
}
