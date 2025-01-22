import {
  Body,
  Controller,
  Delete,
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
import { GlobalGuard } from '~/guards/global/global.guard';
import { BulkDataAliasService } from '~/services/bulk-data-alias.service';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { DataApiLimiterGuard } from '~/guards/data-api-limiter.guard';
import { TenantContext } from '~/decorators/tenant-context.decorator';
import { NcContext, NcRequest } from '~/interface/config';

@Controller()
@UseGuards(DataApiLimiterGuard, GlobalGuard)
export class BulkDataAliasController {
  constructor(protected bulkDataAliasService: BulkDataAliasService) {}

  @Post(['/api/v1/db/data/bulk/:orgs/:baseName/:tableName'])
  @HttpCode(200)
  @Acl('bulkDataInsert')
  async bulkDataInsert(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Res() res: Response,
    @Param('baseName') baseName: string,
    @Param('tableName') tableName: string,
    @Body() body: any,
    @Query('undo') undo: string,
  ) {
    const exists = await this.bulkDataAliasService.bulkDataInsert(context, {
      body: body,
      cookie: req,
      baseName: baseName,
      tableName: tableName,
      undo: undo === 'true',
    });

    res.header('nc-operation-id', req.ncParentAuditId).json(exists);
  }

  @Patch(['/api/v1/db/data/bulk/:orgs/:baseName/:tableName'])
  @Acl('bulkDataUpdate')
  async bulkDataUpdate(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('baseName') baseName: string,
    @Param('tableName') tableName: string,
    @Body() body: any,
  ) {
    return await this.bulkDataAliasService.bulkDataUpdate(context, {
      body: body,
      cookie: req,
      baseName: baseName,
      tableName: tableName,
    });
  }

  // todo: Integrate with filterArrJson bulkDataUpdateAll
  @Patch(['/api/v1/db/data/bulk/:orgs/:baseName/:tableName/all'])
  @Acl('bulkDataUpdateAll')
  async bulkDataUpdateAll(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('baseName') baseName: string,
    @Param('tableName') tableName: string,
    @Body() body: any,
  ) {
    return await this.bulkDataAliasService.bulkDataUpdateAll(context, {
      body: body,
      cookie: req,
      baseName: baseName,
      tableName: tableName,
      query: req.query,
    });
  }

  @Delete(['/api/v1/db/data/bulk/:orgs/:baseName/:tableName'])
  @Acl('bulkDataDelete')
  async bulkDataDelete(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('baseName') baseName: string,
    @Param('tableName') tableName: string,
    @Body() body: any,
  ) {
    return await this.bulkDataAliasService.bulkDataDelete(context, {
      body: body,
      cookie: req,
      baseName: baseName,
      tableName: tableName,
    });
  }

  // todo: Integrate with filterArrJson bulkDataDeleteAll

  @Delete(['/api/v1/db/data/bulk/:orgs/:baseName/:tableName/all'])
  @Acl('bulkDataDeleteAll')
  async bulkDataDeleteAll(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('baseName') baseName: string,
    @Param('tableName') tableName: string,
  ) {
    return await this.bulkDataAliasService.bulkDataDeleteAll(context, {
      // cookie: req,
      baseName: baseName,
      tableName: tableName,
      query: req.query,
      viewName: req.query.viewId,
      req,
    });
  }

  @Post(['/api/v1/db/data/bulk/:orgs/:baseName/:tableName/upsert'])
  @Acl('bulkDataUpsert')
  async bulkDataUpsert(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('baseName') baseName: string,
    @Param('tableName') tableName: string,
    @Body() body: any,
    @Query('undo') undo: string,
  ) {
    return await this.bulkDataAliasService.bulkDataUpsert(context, {
      body: body,
      cookie: req,
      baseName: baseName,
      tableName: tableName,
      undo: undo === 'true',
    });
  }
}
