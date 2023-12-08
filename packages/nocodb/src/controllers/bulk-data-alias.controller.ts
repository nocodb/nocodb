import {
  Body,
  Controller,
  Delete,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { GlobalGuard } from '~/guards/global/global.guard';
import { BulkDataAliasService } from '~/services/bulk-data-alias.service';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { DataApiLimiterGuard } from '~/guards/data-api-limiter.guard';

@Controller()
@UseGuards(DataApiLimiterGuard, GlobalGuard)
export class BulkDataAliasController {
  constructor(private bulkDataAliasService: BulkDataAliasService) {}

  @Post(['/api/v1/db/data/bulk/:orgs/:baseName/:tableName'])
  @HttpCode(200)
  @Acl('bulkDataInsert')
  async bulkDataInsert(
    @Req() req: Request,
    @Res() res: Response,
    @Param('baseName') baseName: string,
    @Param('tableName') tableName: string,
    @Body() body: any,
  ) {
    const exists = await this.bulkDataAliasService.bulkDataInsert({
      body: body,
      cookie: req,
      baseName: baseName,
      tableName: tableName,
    });

    res.json(exists);
  }

  @Patch(['/api/v1/db/data/bulk/:orgs/:baseName/:tableName'])
  @Acl('bulkDataUpdate')
  async bulkDataUpdate(
    @Req() req: Request,
    @Param('baseName') baseName: string,
    @Param('tableName') tableName: string,
    @Body() body: any,
  ) {
    return await this.bulkDataAliasService.bulkDataUpdate({
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
    @Req() req: Request,
    @Param('baseName') baseName: string,
    @Param('tableName') tableName: string,
    @Body() body: any,
  ) {
    return await this.bulkDataAliasService.bulkDataUpdateAll({
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
    @Req() req: Request,
    @Param('baseName') baseName: string,
    @Param('tableName') tableName: string,
    @Body() body: any,
  ) {
    return await this.bulkDataAliasService.bulkDataDelete({
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
    @Req() req: Request,
    @Param('baseName') baseName: string,
    @Param('tableName') tableName: string,
  ) {
    return await this.bulkDataAliasService.bulkDataDeleteAll({
      // cookie: req,
      baseName: baseName,
      tableName: tableName,
      query: req.query,
    });
  }
}
