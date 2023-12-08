import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { DataAliasNestedService } from '~/services/data-alias-nested.service';
import { GlobalGuard } from '~/guards/global/global.guard';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { DataApiLimiterGuard } from '~/guards/data-api-limiter.guard';

@Controller()
@UseGuards(DataApiLimiterGuard, GlobalGuard)
export class DataAliasNestedController {
  constructor(private dataAliasNestedService: DataAliasNestedService) {}

  // todo: handle case where the given column is not ltar
  @Get(['/api/v1/db/data/:orgs/:baseName/:tableName/:rowId/mm/:columnName'])
  @Acl('mmList')
  async mmList(
    @Req() req: Request,
    @Param('columnName') columnName: string,
    @Param('rowId') rowId: string,
    @Param('baseName') baseName: string,
    @Param('tableName') tableName: string,
  ) {
    return await this.dataAliasNestedService.mmList({
      query: req.query,
      columnName: columnName,
      rowId: rowId,
      baseName: baseName,
      tableName: tableName,
    });
  }

  @Get([
    '/api/v1/db/data/:orgs/:baseName/:tableName/:rowId/mm/:columnName/exclude',
  ])
  @Acl('mmExcludedList')
  async mmExcludedList(
    @Req() req: Request,
    @Param('columnName') columnName: string,
    @Param('rowId') rowId: string,
    @Param('baseName') baseName: string,
    @Param('tableName') tableName: string,
  ) {
    return await this.dataAliasNestedService.mmExcludedList({
      query: req.query,
      columnName: columnName,
      rowId: rowId,
      baseName: baseName,
      tableName: tableName,
    });
  }

  @Get([
    '/api/v1/db/data/:orgs/:baseName/:tableName/:rowId/hm/:columnName/exclude',
  ])
  @Acl('hmExcludedList')
  async hmExcludedList(
    @Req() req: Request,
    @Param('columnName') columnName: string,
    @Param('rowId') rowId: string,
    @Param('baseName') baseName: string,
    @Param('tableName') tableName: string,
  ) {
    return await this.dataAliasNestedService.hmExcludedList({
      query: req.query,
      columnName: columnName,
      rowId: rowId,
      baseName: baseName,
      tableName: tableName,
    });
  }

  @Get([
    '/api/v1/db/data/:orgs/:baseName/:tableName/:rowId/bt/:columnName/exclude',
  ])
  @Acl('btExcludedList')
  async btExcludedList(
    @Req() req: Request,
    @Param('columnName') columnName: string,
    @Param('rowId') rowId: string,
    @Param('baseName') baseName: string,
    @Param('tableName') tableName: string,
  ) {
    return await this.dataAliasNestedService.btExcludedList({
      query: req.query,
      columnName: columnName,
      rowId: rowId,
      baseName: baseName,
      tableName: tableName,
    });
  }

  // todo: handle case where the given column is not ltar

  @Get(['/api/v1/db/data/:orgs/:baseName/:tableName/:rowId/hm/:columnName'])
  @Acl('hmList')
  async hmList(
    @Req() req: Request,
    @Param('columnName') columnName: string,
    @Param('rowId') rowId: string,
    @Param('baseName') baseName: string,
    @Param('tableName') tableName: string,
  ) {
    return await this.dataAliasNestedService.hmList({
      query: req.query,
      columnName: columnName,
      rowId: rowId,
      baseName: baseName,
      tableName: tableName,
    });
  }

  @Delete([
    '/api/v1/db/data/:orgs/:baseName/:tableName/:rowId/:relationType/:columnName/:refRowId',
  ])
  @Acl('relationDataRemove')
  async relationDataRemove(
    @Req() req: Request,
    @Param('columnName') columnName: string,
    @Param('rowId') rowId: string,
    @Param('baseName') baseName: string,
    @Param('tableName') tableName: string,
    @Param('refRowId') refRowId: string,
  ) {
    await this.dataAliasNestedService.relationDataRemove({
      columnName: columnName,
      rowId: rowId,
      baseName: baseName,
      tableName: tableName,
      cookie: req,
      refRowId: refRowId,
    });

    return { msg: 'The relation data has been deleted successfully' };
  }

  // todo: Give proper error message when reference row is already related and handle duplicate ref row id in hm
  @Post([
    '/api/v1/db/data/:orgs/:baseName/:tableName/:rowId/:relationType/:columnName/:refRowId',
  ])
  @Acl('relationDataAdd')
  @HttpCode(200)
  async relationDataAdd(
    @Req() req: Request,
    @Param('columnName') columnName: string,
    @Param('rowId') rowId: string,
    @Param('baseName') baseName: string,
    @Param('tableName') tableName: string,
    @Param('refRowId') refRowId: string,
  ) {
    await this.dataAliasNestedService.relationDataAdd({
      columnName: columnName,
      rowId: rowId,
      baseName: baseName,
      tableName: tableName,
      cookie: req,
      refRowId: refRowId,
    });

    return { msg: 'The relation data has been created successfully' };
  }
}
