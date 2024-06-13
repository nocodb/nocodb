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
import { TenantContext } from '~/decorators/tenant-context.decorator';
import { NcContext } from '~/interface/config';

@Controller()
@UseGuards(DataApiLimiterGuard, GlobalGuard)
export class OldDatasController {
  constructor(private readonly oldDatasService: OldDatasService) {}

  @Get('/nc/:baseId/api/v1/:tableName')
  @Acl('dataList')
  async dataList(
    @TenantContext() context: NcContext,
    @Request() req,
    @Response() res,
    @Param('baseId') baseId: string,
    @Param('tableName') tableName: string,
  ) {
    res.json(
      await this.oldDatasService.dataList(context, {
        query: req.query,
        baseId: baseId,
        tableName: tableName,
      }),
    );
  }

  @Get('/nc/:baseId/api/v1/:tableName/count')
  @Acl('dataCount')
  async dataCount(
    @TenantContext() context: NcContext,
    @Request() req,
    @Response() res,
    @Param('baseId') baseId: string,
    @Param('tableName') tableName: string,
  ) {
    res.json(
      await this.oldDatasService.dataCount(context, {
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
    @TenantContext() context: NcContext,
    @Request() req,
    @Response() res,
    @Param('baseId') baseId: string,
    @Param('tableName') tableName: string,
    @Body() body: any,
  ) {
    res.json(
      await this.oldDatasService.dataInsert(context, {
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
    @TenantContext() context: NcContext,
    @Request() req,
    @Response() res,
    @Param('baseId') baseId: string,
    @Param('tableName') tableName: string,
    @Param('rowId') rowId: string,
  ) {
    res.json(
      await this.oldDatasService.dataRead(context, {
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
    @TenantContext() context: NcContext,
    @Request() req,
    @Response() res,
    @Param('baseId') baseId: string,
    @Param('tableName') tableName: string,
    @Param('rowId') rowId: string,
  ) {
    res.json(
      await this.oldDatasService.dataUpdate(context, {
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
    @TenantContext() context: NcContext,
    @Request() req,
    @Response() res,
    @Param('baseId') baseId: string,
    @Param('tableName') tableName: string,
    @Param('rowId') rowId: string,
  ) {
    res.json(
      await this.oldDatasService.dataDelete(context, {
        baseId: baseId,
        tableName: tableName,
        cookie: req,
        rowId: rowId,
      }),
    );
  }
}
