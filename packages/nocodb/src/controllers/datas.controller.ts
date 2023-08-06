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
import { GlobalGuard } from '~/guards/global/global.guard';
import { DatasService } from '~/services/datas.service';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';

@Controller()
@UseGuards(GlobalGuard)
export class DatasController {
  constructor(private readonly datasService: DatasService) {}

  @Get('/data/:viewId/')
  @Acl('dataList')
  async dataList(@Request() req, @Param('viewId') viewId: string) {
    return await this.datasService.dataListByViewId({
      viewId: viewId,
      query: req.query,
    });
  }

  @Get('/data/:viewId/:rowId/mm/:colId')
  @Acl('mmList')
  async mmList(
    @Request() req,
    @Param('viewId') viewId: string,
    @Param('colId') colId: string,
    @Param('rowId') rowId: string,
  ) {
    return await this.datasService.mmList({
      viewId: viewId,
      colId: colId,
      rowId: rowId,
      query: req.query,
    });
  }

  @Get('/data/:viewId/:rowId/mm/:colId/exclude')
  @Acl('mmExcludedList')
  async mmExcludedList(
    @Request() req,
    @Param('viewId') viewId: string,
    @Param('colId') colId: string,
    @Param('rowId') rowId: string,
  ) {
    return await this.datasService.mmExcludedList({
      viewId: viewId,
      colId: colId,
      rowId: rowId,
      query: req.query,
    });
  }

  @Get('/data/:viewId/:rowId/hm/:colId/exclude')
  @Acl('hmExcludedList')
  async hmExcludedList(
    @Request() req,
    @Param('viewId') viewId: string,
    @Param('colId') colId: string,
    @Param('rowId') rowId: string,
  ) {
    await this.datasService.hmExcludedList({
      viewId: viewId,
      colId: colId,
      rowId: rowId,
      query: req.query,
    });
  }

  @Get('/data/:viewId/:rowId/bt/:colId/exclude')
  @Acl('btExcludedList')
  async btExcludedList(
    @Request() req,
    @Param('viewId') viewId: string,
    @Param('colId') colId: string,
    @Param('rowId') rowId: string,
  ) {
    return await this.datasService.btExcludedList({
      viewId: viewId,
      colId: colId,
      rowId: rowId,
      query: req.query,
    });
  }

  @Get('/data/:viewId/:rowId/hm/:colId')
  @Acl('hmList')
  async hmList(
    @Request() req,
    @Param('viewId') viewId: string,
    @Param('colId') colId: string,
    @Param('rowId') rowId: string,
  ) {
    return await this.datasService.hmList({
      viewId: viewId,
      colId: colId,
      rowId: rowId,
      query: req.query,
    });
  }

  @Get('/data/:viewId/:rowId')
  @Acl('dataRead')
  async dataRead(
    @Request() req,
    @Param('viewId') viewId: string,
    @Param('rowId') rowId: string,
  ) {
    return await this.datasService.dataReadByViewId({
      viewId,
      rowId,
      query: req.query,
    });
  }

  @Post('/data/:viewId/')
  @HttpCode(200)
  @Acl('dataInsert')
  async dataInsert(
    @Request() req,
    @Param('viewId') viewId: string,
    @Body() body: any,
  ) {
    return await this.datasService.dataInsertByViewId({
      viewId: viewId,
      body: body,
      cookie: req,
    });
  }

  @Patch('/data/:viewId/:rowId')
  @Acl('dataUpdate')
  async dataUpdate(
    @Request() req,
    @Param('viewId') viewId: string,
    @Param('rowId') rowId: string,
    @Body() body: any,
  ) {
    return await this.datasService.dataUpdateByViewId({
      viewId: viewId,
      rowId: rowId,
      body: body,
      cookie: req,
    });
  }

  @Delete('/data/:viewId/:rowId')
  @Acl('dataDelete')
  async dataDelete(
    @Request() req,
    @Param('viewId') viewId: string,
    @Param('rowId') rowId: string,
  ) {
    return await this.datasService.dataDeleteByViewId({
      viewId: viewId,
      rowId: rowId,
      cookie: req,
    });
  }

  @Delete('/data/:viewId/:rowId/:relationType/:colId/:childId')
  @Acl('relationDataDelete')
  async relationDataDelete(
    @Request() req,
    @Param('viewId') viewId: string,
    @Param('rowId') rowId: string,
    @Param('relationType') relationType: string,
    @Param('colId') colId: string,
    @Param('childId') childId: string,
  ) {
    await this.datasService.relationDataDelete({
      viewId: viewId,
      colId: colId,
      childId: childId,
      rowId: rowId,
      cookie: req,
    });

    return { msg: 'The relation data has been deleted successfully' };
  }

  @Post('/data/:viewId/:rowId/:relationType/:colId/:childId')
  @HttpCode(200)
  @Acl('relationDataAdd')
  async relationDataAdd(
    @Request() req,
    @Param('viewId') viewId: string,
    @Param('rowId') rowId: string,
    @Param('relationType') relationType: string,
    @Param('colId') colId: string,
    @Param('childId') childId: string,
  ) {
    await this.datasService.relationDataAdd({
      viewId: viewId,
      colId: colId,
      childId: childId,
      rowId: rowId,
      cookie: req,
    });

    return { msg: 'The relation data has been created successfully' };
  }
}
