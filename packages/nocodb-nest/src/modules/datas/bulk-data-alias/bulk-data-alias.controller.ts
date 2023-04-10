import {
  Controller,
  Param,
  Post,
  Request,
  Body,
  Patch,
  Delete, UseGuards,
} from '@nestjs/common'
import { Acl, ExtractProjectIdMiddleware } from '../../../middlewares/extract-project-id/extract-project-id.middleware'
import { BulkDataAliasService } from './bulk-data-alias.service';
import { AuthGuard } from '@nestjs/passport';

@Controller()
@UseGuards(ExtractProjectIdMiddleware, AuthGuard('jwt'))
export class BulkDataAliasController {
  constructor(private bulkDataAliasService: BulkDataAliasService) {}

  @Post('/api/v1/db/data/bulk/:orgs/:projectName/:tableName')
  @Acl('bulkDataInsert')
  async bulkDataInsert(
    @Request() req,
    @Param('projectName') projectName: string,
    @Param('tableName') tableName: string,
    @Body() body: any,
  ) {
    return await this.bulkDataAliasService.bulkDataInsert({
      body: body,
      cookie: req,
      projectName: projectName,
      tableName: tableName,
    });
  }

  @Patch('/api/v1/db/data/bulk/:orgs/:projectName/:tableName')
  @Acl('bulkDataUpdate')
  async bulkDataUpdate(
    @Request() req,
    @Param('projectName') projectName: string,
    @Param('tableName') tableName: string,
    @Body() body: any,
  ) {
    return await this.bulkDataAliasService.bulkDataUpdate({
      body: body,
      cookie: req,
      projectName: projectName,
      tableName: tableName,
    });
  }

  // todo: Integrate with filterArrJson bulkDataUpdateAll
  @Patch('/api/v1/db/data/bulk/:orgs/:projectName/:tableName/all')
  @Acl('bulkDataUpdateAll')
  async bulkDataUpdateAll(
    @Request() req,
    @Param('projectName') projectName: string,
    @Param('tableName') tableName: string,
    @Body() body: any,
  ) {
    return await this.bulkDataAliasService.bulkDataUpdateAll({
      body: body,
      cookie: req,
      projectName: projectName,
      tableName: tableName,
      query: req.query,
    });
  }

  @Delete('/api/v1/db/data/bulk/:orgs/:projectName/:tableName')
  @Acl('bulkDataDelete')
  async bulkDataDelete(
    @Request() req,
    @Param('projectName') projectName: string,
    @Param('tableName') tableName: string,
    @Body() body: any,
  ) {
    return await this.bulkDataAliasService.bulkDataDelete({
      body: body,
      cookie: req,
      projectName: projectName,
      tableName: tableName,
    });
  }

  // todo: Integrate with filterArrJson bulkDataDeleteAll

  @Delete('/api/v1/db/data/bulk/:orgs/:projectName/:tableName/all')
  @Acl('bulkDataDeleteAll')
  async bulkDataDeleteAll(
    @Request() req,
    @Param('projectName') projectName: string,
    @Param('tableName') tableName: string,
  ) {
    return await this.bulkDataAliasService.bulkDataDeleteAll({
      // cookie: req,
      projectName: projectName,
      tableName: tableName,
      query: req.query,
    });
  }
}
