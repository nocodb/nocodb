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
import { Request, Response } from 'express';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { DataTableService } from '~/services/data-table.service';
import { parseHrtimeToMilliSeconds } from '~/helpers';
import { DataApiLimiterGuard } from '~/guards/data-api-limiter.guard';
import { GlobalGuard } from '~/guards/global/global.guard';

@Controller()
@UseGuards(DataApiLimiterGuard, GlobalGuard)
export class DataTableController {
  constructor(private readonly dataTableService: DataTableService) {}

  // todo: Handle the error case where view doesnt belong to model
  @Get('/api/v2/tables/:modelId/records')
  @Acl('dataList')
  async dataList(
    @Req() req: Request,
    @Res() res: Response,
    @Param('modelId') modelId: string,
    @Query('viewId') viewId: string,
  ) {
    const startTime = process.hrtime();
    const responseData = await this.dataTableService.dataList({
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
    @Req() req: Request,
    @Res() res: Response,
    @Param('modelId') modelId: string,
    @Query('viewId') viewId: string,
  ) {
    const countResult = await this.dataTableService.dataCount({
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
    @Req() req: Request,
    @Param('modelId') modelId: string,
    @Query('viewId') viewId: string,
    @Body() body: any,
  ) {
    return await this.dataTableService.dataInsert({
      modelId: modelId,
      body: body,
      viewId,
      cookie: req,
    });
  }

  @Patch(['/api/v2/tables/:modelId/records'])
  @Acl('dataUpdate')
  async dataUpdate(
    @Req() req: Request,
    @Param('modelId') modelId: string,
    @Query('viewId') viewId: string,
    @Param('rowId') _rowId: string,
  ) {
    return await this.dataTableService.dataUpdate({
      modelId: modelId,
      body: req.body,
      cookie: req,
      viewId,
    });
  }

  @Delete(['/api/v2/tables/:modelId/records'])
  @Acl('dataDelete')
  async dataDelete(
    @Req() req: Request,
    @Param('modelId') modelId: string,
    @Query('viewId') viewId: string,
    @Param('rowId') _rowId: string,
  ) {
    return await this.dataTableService.dataDelete({
      modelId: modelId,
      cookie: req,
      viewId,
      body: req.body,
    });
  }

  @Get(['/api/v2/tables/:modelId/records/:rowId'])
  @Acl('dataRead')
  async dataRead(
    @Req() req: Request,
    @Param('modelId') modelId: string,
    @Query('viewId') viewId: string,
    @Param('rowId') rowId: string,
  ) {
    return await this.dataTableService.dataRead({
      modelId,
      rowId: rowId,
      query: req.query,
      viewId,
    });
  }

  @Get(['/api/v2/tables/:modelId/links/:columnId/records/:rowId'])
  @Acl('nestedDataList')
  async nestedDataList(
    @Req() req: Request,
    @Param('modelId') modelId: string,
    @Query('viewId') viewId: string,
    @Param('columnId') columnId: string,
    @Param('rowId') rowId: string,
  ) {
    return await this.dataTableService.nestedDataList({
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
    @Req() req: Request,
    @Param('modelId') modelId: string,
    @Query('viewId') viewId: string,
    @Param('columnId') columnId: string,
    @Param('rowId') rowId: string,
    @Body()
    refRowIds: string | string[] | number | number[] | Record<string, any>,
  ) {
    return await this.dataTableService.nestedLink({
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
    @Req() req: Request,
    @Param('modelId') modelId: string,
    @Query('viewId') viewId: string,
    @Param('columnId') columnId: string,
    @Param('rowId') rowId: string,
    @Body()
    refRowIds: string | string[] | number | number[] | Record<string, any>,
  ) {
    return await this.dataTableService.nestedUnlink({
      modelId,
      rowId: rowId,
      query: req.query,
      viewId,
      columnId,
      refRowIds,
      cookie: req,
    });
  }
}
