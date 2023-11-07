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
import { GlobalGuard } from '~/guards/global/global.guard';
import { parseHrtimeToMilliSeconds } from '~/helpers';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { DatasService } from '~/services/datas.service';
import { DataApiLimiterGuard } from '~/guards/data-api-limiter.guard';

@Controller()
@UseGuards(DataApiLimiterGuard, GlobalGuard)
export class DataAliasController {
  constructor(private readonly datasService: DatasService) {}

  // todo: Handle the error case where view doesnt belong to model
  @Get([
    '/api/v1/db/data/:orgs/:baseName/:tableName',
    '/api/v1/db/data/:orgs/:baseName/:tableName/views/:viewName',
  ])
  @Acl('dataList')
  async dataList(
    @Req() req: Request,
    @Res() res: Response,
    @Param('baseName') baseName: string,
    @Param('tableName') tableName: string,
    @Param('viewName') viewName: string,
    @Query('opt') opt: string,
  ) {
    const startTime = process.hrtime();
    const responseData = await this.datasService.dataList({
      query: req.query,
      baseName: baseName,
      tableName: tableName,
      viewName: viewName,
      disableOptimization: opt === 'false',
    });
    const elapsedMilliSeconds = parseHrtimeToMilliSeconds(
      process.hrtime(startTime),
    );
    res.setHeader('xc-db-response', elapsedMilliSeconds);
    if (responseData['stats']) {
      responseData['stats'].apiHandlingTime = elapsedMilliSeconds;
    }

    res.json(responseData);
  }

  @Get([
    '/api/v1/db/data/:orgs/:baseName/:tableName/find-one',
    '/api/v1/db/data/:orgs/:baseName/:tableName/views/:viewName/find-one',
  ])
  @Acl('dataFindOne')
  async dataFindOne(
    @Req() req: Request,
    @Param('baseName') baseName: string,
    @Param('tableName') tableName: string,
    @Param('viewName') viewName: string,
  ) {
    return await this.datasService.dataFindOne({
      query: req.query,
      baseName: baseName,
      tableName: tableName,
      viewName: viewName,
    });
  }

  @Get([
    '/api/v1/db/data/:orgs/:baseName/:tableName/groupby',
    '/api/v1/db/data/:orgs/:baseName/:tableName/views/:viewName/groupby',
  ])
  @Acl('dataGroupBy')
  async dataGroupBy(
    @Req() req: Request,
    @Param('baseName') baseName: string,
    @Param('tableName') tableName: string,
    @Param('viewName') viewName: string,
  ) {
    return await this.datasService.dataGroupBy({
      query: req.query,
      baseName: baseName,
      tableName: tableName,
      viewName: viewName,
    });
  }

  @Get([
    '/api/v1/db/data/:orgs/:baseName/:tableName/count',
    '/api/v1/db/data/:orgs/:baseName/:tableName/views/:viewName/count',
  ])
  @Acl('dataCount')
  async dataCount(
    @Req() req: Request,
    @Res() res: Response,
    @Param('baseName') baseName: string,
    @Param('tableName') tableName: string,
    @Param('viewName') viewName: string,
  ) {
    const countResult = await this.datasService.dataCount({
      query: req.query,
      baseName: baseName,
      tableName: tableName,
      viewName: viewName,
    });

    res.json(countResult);
  }

  @Post([
    '/api/v1/db/data/:orgs/:baseName/:tableName',
    '/api/v1/db/data/:orgs/:baseName/:tableName/views/:viewName',
  ])
  @HttpCode(200)
  @Acl('dataInsert')
  async dataInsert(
    @Req() req: Request,
    @Param('baseName') baseName: string,
    @Param('tableName') tableName: string,
    @Param('viewName') viewName: string,
    @Body() body: any,
    @Query('opt') opt: string,
  ) {
    return await this.datasService.dataInsert({
      baseName: baseName,
      tableName: tableName,
      viewName: viewName,
      body: body,
      cookie: req,
      disableOptimization: opt === 'false',
    });
  }

  @Patch([
    '/api/v1/db/data/:orgs/:baseName/:tableName/:rowId',
    '/api/v1/db/data/:orgs/:baseName/:tableName/views/:viewName/:rowId',
  ])
  @Acl('dataUpdate')
  async dataUpdate(
    @Req() req: Request,
    @Param('baseName') baseName: string,
    @Param('tableName') tableName: string,
    @Param('viewName') viewName: string,
    @Param('rowId') rowId: string,
    @Query('opt') opt: string,
  ) {
    return await this.datasService.dataUpdate({
      baseName: baseName,
      tableName: tableName,
      viewName: viewName,
      body: req.body,
      cookie: req,
      rowId: rowId,
      disableOptimization: opt === 'false',
    });
  }

  @Delete([
    '/api/v1/db/data/:orgs/:baseName/:tableName/:rowId',
    '/api/v1/db/data/:orgs/:baseName/:tableName/views/:viewName/:rowId',
  ])
  @Acl('dataDelete')
  async dataDelete(
    @Req() req: Request,
    @Param('baseName') baseName: string,
    @Param('tableName') tableName: string,
    @Param('viewName') viewName: string,
    @Param('rowId') rowId: string,
  ) {
    return await this.datasService.dataDelete({
      baseName: baseName,
      tableName: tableName,
      viewName: viewName,
      cookie: req,
      rowId: rowId,
    });
  }

  @Get([
    '/api/v1/db/data/:orgs/:baseName/:tableName/:rowId',
    '/api/v1/db/data/:orgs/:baseName/:tableName/views/:viewName/:rowId',
  ])
  @Acl('dataRead')
  async dataRead(
    @Req() req: Request,
    @Param('baseName') baseName: string,
    @Param('tableName') tableName: string,
    @Param('viewName') viewName: string,
    @Param('rowId') rowId: string,
    @Query('opt') opt: string,
    @Query('getHiddenColumn') getHiddenColumn: boolean,
  ) {
    return await this.datasService.dataRead({
      baseName: baseName,
      tableName: tableName,
      viewName: viewName,
      rowId: rowId,
      query: req.query,
      disableOptimization: opt === 'false',
      getHiddenColumn: getHiddenColumn,
    });
  }

  @Get([
    '/api/v1/db/data/:orgs/:baseName/:tableName/:rowId/exist',
    '/api/v1/db/data/:orgs/:baseName/:tableName/views/:viewName/:rowId/exist',
  ])
  @Acl('dataExist')
  async dataExist(
    @Req() req: Request,
    @Res() res: Response,
    @Param('baseName') baseName: string,
    @Param('tableName') tableName: string,
    @Param('viewName') viewName: string,
    @Param('rowId') rowId: string,
  ) {
    const exists = await this.datasService.dataExist({
      baseName: baseName,
      tableName: tableName,
      viewName: viewName,
      rowId: rowId,
      query: req.query,
    });

    res.json(exists);
  }

  // todo: Handle the error case where view doesnt belong to model

  @Get([
    '/api/v1/db/data/:orgs/:baseName/:tableName/group/:columnId',
    '/api/v1/db/data/:orgs/:baseName/:tableName/views/:viewName/group/:columnId',
  ])
  @Acl('groupedDataList')
  async groupedDataList(
    @Req() req: Request,
    @Res() res: Response,
    @Param('baseName') baseName: string,
    @Param('tableName') tableName: string,
    @Param('viewName') viewName: string,
    @Param('columnId') columnId: string,
  ) {
    const startTime = process.hrtime();
    const groupedData = await this.datasService.groupedDataList({
      baseName: baseName,
      tableName: tableName,
      viewName: viewName,
      query: req.query,
      columnId: columnId,
    });
    const elapsedSeconds = parseHrtimeToMilliSeconds(process.hrtime(startTime));
    res.setHeader('xc-db-response', elapsedSeconds);
    res.json(groupedData);
  }
}
