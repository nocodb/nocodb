import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { DataAliasNestedService } from '~/services/data-alias-nested.service';
import { GlobalGuard } from '~/guards/global/global.guard';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';

@Controller()
@UseGuards(GlobalGuard)
export class DataAliasNestedController {
  constructor(private dataAliasNestedService: DataAliasNestedService) {}

  // todo: handle case where the given column is not ltar
  @Get([
    '/api/v1/db/data/:orgs/:baseName/:tableName/:rowId/mm/:columnName',
    '/api/v1/data/:orgs/:baseName/:tableName/:rowId/mm/:columnName',
  ])
  @Acl('mmList')
  async mmList(
    @Request() req,
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
    '/api/v1/data/:orgs/:baseName/:tableName/:rowId/mm/:columnName/exclude',
  ])
  @Acl('mmExcludedList')
  async mmExcludedList(
    @Request() req,
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
    '/api/v1/data/:orgs/:baseName/:tableName/:rowId/hm/:columnName/exclude',
  ])
  @Acl('hmExcludedList')
  async hmExcludedList(
    @Request() req,
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
    '/api/v1/data/:orgs/:baseName/:tableName/:rowId/bt/:columnName/exclude',
  ])
  @Acl('btExcludedList')
  async btExcludedList(
    @Request() req,
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

  @Get([
    '/api/v1/db/data/:orgs/:baseName/:tableName/:rowId/hm/:columnName',
    '/api/v1/data/:orgs/:baseName/:tableName/:rowId/hm/:columnName',
  ])
  @Acl('hmList')
  async hmList(
    @Request() req,
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
    '/api/v1/data/:orgs/:baseName/:tableName/:rowId/:relationType/:columnName/:refRowId',
  ])
  @Acl('relationDataRemove')
  async relationDataRemove(
    @Request() req,
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
    '/api/v1/data/:orgs/:baseName/:tableName/:rowId/:relationType/:columnName/:refRowId',
  ])
  @Acl('relationDataAdd')
  @HttpCode(200)
  async relationDataAdd(
    @Request() req,
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
