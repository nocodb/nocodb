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
import { DataAliasNestedService } from '~/services/data-alias-nested.service';
import { GlobalGuard } from '~/guards/global/global.guard';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { DataApiLimiterGuard } from '~/guards/data-api-limiter.guard';
import { TenantContext } from '~/decorators/tenant-context.decorator';
import { NcContext, NcRequest } from '~/interface/config';

@Controller()
@UseGuards(DataApiLimiterGuard, GlobalGuard)
export class DataAliasNestedController {
  constructor(private dataAliasNestedService: DataAliasNestedService) {}

  // todo: handle case where the given column is not ltar
  @Get(['/api/v1/db/data/:orgs/:baseName/:tableName/:rowId/mm/:columnName'])
  @Acl('mmList')
  async mmList(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('columnName') columnName: string,
    @Param('rowId') rowId: string,
    @Param('baseName') baseName: string,
    @Param('tableName') tableName: string,
  ) {
    return await this.dataAliasNestedService.mmList(context, {
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
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('columnName') columnName: string,
    @Param('rowId') rowId: string,
    @Param('baseName') baseName: string,
    @Param('tableName') tableName: string,
  ) {
    return await this.dataAliasNestedService.mmExcludedList(context, {
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
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('columnName') columnName: string,
    @Param('rowId') rowId: string,
    @Param('baseName') baseName: string,
    @Param('tableName') tableName: string,
  ) {
    return await this.dataAliasNestedService.hmExcludedList(context, {
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
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('columnName') columnName: string,
    @Param('rowId') rowId: string,
    @Param('baseName') baseName: string,
    @Param('tableName') tableName: string,
  ) {
    return await this.dataAliasNestedService.btExcludedList(context, {
      query: req.query,
      columnName: columnName,
      rowId: rowId,
      baseName: baseName,
      tableName: tableName,
    });
  }

  @Get([
    '/api/v1/db/data/:orgs/:baseName/:tableName/:rowId/oo/:columnName/exclude',
  ])
  @Acl('ooExcludedList')
  async ooExcludedList(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('columnName') columnName: string,
    @Param('rowId') rowId: string,
    @Param('baseName') baseName: string,
    @Param('tableName') tableName: string,
  ) {
    return await this.dataAliasNestedService.ooExcludedList(context, {
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
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('columnName') columnName: string,
    @Param('rowId') rowId: string,
    @Param('baseName') baseName: string,
    @Param('tableName') tableName: string,
  ) {
    return await this.dataAliasNestedService.hmList(context, {
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
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('columnName') columnName: string,
    @Param('rowId') rowId: string,
    @Param('baseName') baseName: string,
    @Param('tableName') tableName: string,
    @Param('refRowId') refRowId: string,
  ) {
    await this.dataAliasNestedService.relationDataRemove(context, {
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
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('columnName') columnName: string,
    @Param('rowId') rowId: string,
    @Param('baseName') baseName: string,
    @Param('tableName') tableName: string,
    @Param('refRowId') refRowId: string,
  ) {
    await this.dataAliasNestedService.relationDataAdd(context, {
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
