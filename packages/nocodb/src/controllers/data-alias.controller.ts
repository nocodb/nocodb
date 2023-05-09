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
  Response,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { GlobalGuard } from '../guards/global/global.guard';
import { parseHrtimeToSeconds } from '../helpers';
import { Acl } from '../middlewares/extract-project-id/extract-project-id.middleware';
import { DatasService } from '../services/datas.service';

@Controller()
@UseGuards(GlobalGuard)
export class DataAliasController {
  constructor(private readonly datasService: DatasService) {}

  // todo: Handle the error case where view doesnt belong to model
  @Get([
    '/api/v1/db/data/:orgs/:projectName/:tableName',
    '/api/v1/db/data/:orgs/:projectName/:tableName/views/:viewName',
  ])
  @Acl('dataList')
  async dataList(
    @Request() req,
    @Response() res,
    @Param('projectName') projectName: string,
    @Param('tableName') tableName: string,
    @Param('viewName') viewName: string,
  ) {
    const startTime = process.hrtime();
    const responseData = await this.datasService.dataList({
      query: req.query,
      projectName: projectName,
      tableName: tableName,
      viewName: viewName,
    });
    const elapsedSeconds = parseHrtimeToSeconds(process.hrtime(startTime));
    res.setHeader('xc-db-response', elapsedSeconds);
    res.json(responseData);
  }

  @Get([
    '/api/v1/db/data/:orgs/:projectName/:tableName/find-one',
    '/api/v1/db/data/:orgs/:projectName/:tableName/views/:viewName/find-one',
  ])
  @Acl('dataFindOne')
  async dataFindOne(
    @Request() req,
    @Param('projectName') projectName: string,
    @Param('tableName') tableName: string,
    @Param('viewName') viewName: string,
  ) {
    return await this.datasService.dataFindOne({
      query: req.query,
      projectName: projectName,
      tableName: tableName,
      viewName: viewName,
    });
  }

  @Get([
    '/api/v1/db/data/:orgs/:projectName/:tableName/groupby',
    '/api/v1/db/data/:orgs/:projectName/:tableName/views/:viewName/groupby',
  ])
  @Acl('dataGroupBy')
  async dataGroupBy(
    @Request() req,
    @Param('projectName') projectName: string,
    @Param('tableName') tableName: string,
    @Param('viewName') viewName: string,
  ) {
    return await this.datasService.dataGroupBy({
      query: req.query,
      projectName: projectName,
      tableName: tableName,
      viewName: viewName,
    });
  }

  @Get([
    '/api/v1/db/data/:orgs/:projectName/:tableName/count',
    '/api/v1/db/data/:orgs/:projectName/:tableName/views/:viewName/count',
  ])
  @Acl('dataCount')
  async dataCount(
    @Request() req,
    @Response() res,
    @Param('projectName') projectName: string,
    @Param('tableName') tableName: string,
    @Param('viewName') viewName: string,
  ) {
    const countResult = await this.datasService.dataCount({
      query: req.query,
      projectName: projectName,
      tableName: tableName,
      viewName: viewName,
    });

    res.json(countResult);
  }

  @Post([
    '/api/v1/db/data/:orgs/:projectName/:tableName',
    '/api/v1/db/data/:orgs/:projectName/:tableName/views/:viewName',
  ])
  @HttpCode(200)
  @Acl('dataInsert')
  async dataInsert(
    @Request() req,
    @Param('projectName') projectName: string,
    @Param('tableName') tableName: string,
    @Param('viewName') viewName: string,
    @Body() body: any,
  ) {
    return await this.datasService.dataInsert({
      projectName: projectName,
      tableName: tableName,
      viewName: viewName,
      body: body,
      cookie: req,
    });
  }

  @Patch([
    '/api/v1/db/data/:orgs/:projectName/:tableName/:rowId',
    '/api/v1/db/data/:orgs/:projectName/:tableName/views/:viewName/:rowId',
  ])
  @Acl('dataUpdate')
  async dataUpdate(
    @Request() req,
    @Param('projectName') projectName: string,
    @Param('tableName') tableName: string,
    @Param('viewName') viewName: string,
    @Param('rowId') rowId: string,
  ) {
    return await this.datasService.dataUpdate({
      projectName: projectName,
      tableName: tableName,
      viewName: viewName,
      body: req.body,
      cookie: req,
      rowId: rowId,
    });
  }

  @Delete([
    '/api/v1/db/data/:orgs/:projectName/:tableName/:rowId',
    '/api/v1/db/data/:orgs/:projectName/:tableName/views/:viewName/:rowId',
  ])
  @Acl('dataDelete')
  async dataDelete(
    @Request() req,
    @Param('projectName') projectName: string,
    @Param('tableName') tableName: string,
    @Param('viewName') viewName: string,
    @Param('rowId') rowId: string,
  ) {
    return await this.datasService.dataDelete({
      projectName: projectName,
      tableName: tableName,
      viewName: viewName,
      cookie: req,
      rowId: rowId,
    });
  }

  @Get([
    '/api/v1/db/data/:orgs/:projectName/:tableName/:rowId',
    '/api/v1/db/data/:orgs/:projectName/:tableName/views/:viewName/:rowId',
  ])
  @Acl('dataRead')
  async dataRead(
    @Request() req,
    @Param('projectName') projectName: string,
    @Param('tableName') tableName: string,
    @Param('viewName') viewName: string,
    @Param('rowId') rowId: string,
  ) {
    return await this.datasService.dataRead({
      projectName: projectName,
      tableName: tableName,
      viewName: viewName,
      rowId: rowId,
      query: req.query,
    });
  }

  @Get([
    '/api/v1/db/data/:orgs/:projectName/:tableName/:rowId/exist',
    '/api/v1/db/data/:orgs/:projectName/:tableName/views/:viewName/:rowId/exist',
  ])
  @Acl('dataExist')
  async dataExist(
    @Request() req,
    @Response() res,
    @Param('projectName') projectName: string,
    @Param('tableName') tableName: string,
    @Param('viewName') viewName: string,
    @Param('rowId') rowId: string,
  ) {
    const exists = await this.datasService.dataExist({
      projectName: projectName,
      tableName: tableName,
      viewName: viewName,
      rowId: rowId,
      query: req.query,
    });

    res.json(exists);
  }

  // todo: Handle the error case where view doesnt belong to model

  @Get([
    '/api/v1/db/data/:orgs/:projectName/:tableName/group/:columnId',
    '/api/v1/db/data/:orgs/:projectName/:tableName/views/:viewName/group/:columnId',
  ])
  @Acl('groupedDataList')
  async groupedDataList(
    @Request() req,
    @Response() res,
    @Param('projectName') projectName: string,
    @Param('tableName') tableName: string,
    @Param('viewName') viewName: string,
    @Param('columnId') columnId: string,
  ) {
    const startTime = process.hrtime();
    const groupedData = await this.datasService.groupedDataList({
      projectName: projectName,
      tableName: tableName,
      viewName: viewName,
      query: req.query,
      columnId: columnId,
    });
    const elapsedSeconds = parseHrtimeToSeconds(process.hrtime(startTime));
    res.setHeader('xc-db-response', elapsedSeconds);
    res.json(groupedData);
  }
}
