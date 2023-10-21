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
import { OldDatasService } from './old-datas.service';
import { GlobalGuard } from '~/guards/global/global.guard';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { DataApiLimiterGuard } from '~/guards/data-api-limiter.guard';

@Controller()
@UseGuards(DataApiLimiterGuard, GlobalGuard)
export class OldDatasController {
  constructor(private readonly oldDatasService: OldDatasService) {}

  @Get('/nc/:baseId/api/v1/:tableName')
  @Acl('dataList')
  async dataList(
    @Request() req,
    @Response() res,
    @Param('baseId') baseId: string,
    @Param('tableName') tableName: string,
  ) {
    res.json(
      await this.oldDatasService.dataList({
        query: req.query,
        baseId: baseId,
        tableName: tableName,
      }),
    );
  }

  @Get('/nc/:baseId/api/v1/:tableName/count')
  @Acl('dataCount')
  async dataCount(
    @Request() req,
    @Response() res,
    @Param('baseId') baseId: string,
    @Param('tableName') tableName: string,
  ) {
    res.json(
      await this.oldDatasService.dataCount({
        query: req.query,
        baseId: baseId,
        tableName: tableName,
      }),
    );
  }

  @Post('/nc/:baseId/api/v1/:tableName')
  @HttpCode(200)
  @Acl('dataInsert')
  async dataInsert(
    @Request() req,
    @Response() res,
    @Param('baseId') baseId: string,
    @Param('tableName') tableName: string,
    @Body() body: any,
  ) {
    res.json(
      await this.oldDatasService.dataInsert({
        baseId: baseId,
        tableName: tableName,
        body: body,
        cookie: req,
      }),
    );
  }

  @Get('/nc/:baseId/api/v1/:tableName/:rowId')
  @Acl('dataRead')
  async dataRead(
    @Request() req,
    @Response() res,
    @Param('baseId') baseId: string,
    @Param('tableName') tableName: string,
    @Param('rowId') rowId: string,
  ) {
    res.json(
      await this.oldDatasService.dataRead({
        baseId: baseId,
        tableName: tableName,
        rowId: rowId,
        query: req.query,
      }),
    );
  }

  @Patch('/nc/:baseId/api/v1/:tableName/:rowId')
  @Acl('dataUpdate')
  async dataUpdate(
    @Request() req,
    @Response() res,
    @Param('baseId') baseId: string,
    @Param('tableName') tableName: string,
    @Param('rowId') rowId: string,
  ) {
    res.json(
      await this.oldDatasService.dataUpdate({
        baseId: baseId,
        tableName: tableName,
        body: req.body,
        cookie: req,
        rowId: rowId,
      }),
    );
  }

  @Delete('/nc/:baseId/api/v1/:tableName/:rowId')
  @Acl('dataDelete')
  async dataDelete(
    @Request() req,
    @Response() res,
    @Param('baseId') baseId: string,
    @Param('tableName') tableName: string,
    @Param('rowId') rowId: string,
  ) {
    res.json(
      await this.oldDatasService.dataDelete({
        baseId: baseId,
        tableName: tableName,
        cookie: req,
        rowId: rowId,
      }),
    );
  }
}
