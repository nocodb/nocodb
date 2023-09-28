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
import { SharedBasesService } from '~/services/shared-bases.service';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';

@Controller()
@UseGuards(GlobalGuard)
export class SharedBasesController {
  constructor(private readonly sharedBasesService: SharedBasesService) {}

  @Post([
    '/api/v1/db/meta/projects/:baseId/shared',
    '/api/v1/meta/bases/:baseId/shared',
  ])
  @HttpCode(200)
  @Acl('createSharedBaseLink')
  async createSharedBaseLink(
    @Request() req,
    @Body() body: any,
    @Param('baseId') baseId: string,
  ): Promise<any> {
    const sharedBase = await this.sharedBasesService.createSharedBaseLink({
      baseId: baseId,
      roles: body?.roles,
      password: body?.password,
      siteUrl: req.ncSiteUrl,
    });

    return sharedBase;
  }

  @Patch([
    '/api/v1/db/meta/projects/:baseId/shared',
    '/api/v1/meta/bases/:baseId/shared',
  ])
  @Acl('updateSharedBaseLink')
  async updateSharedBaseLink(
    @Request() req,
    @Body() body: any,
    @Param('baseId') baseId: string,
  ): Promise<any> {
    const sharedBase = await this.sharedBasesService.updateSharedBaseLink({
      baseId: baseId,
      roles: body?.roles,
      password: body?.password,
      siteUrl: req.ncSiteUrl,
    });

    return sharedBase;
  }

  @Delete([
    '/api/v1/db/meta/projects/:baseId/shared',
    '/api/v1/meta/bases/:baseId/shared',
  ])
  @Acl('disableSharedBaseLink')
  async disableSharedBaseLink(@Param('baseId') baseId: string): Promise<any> {
    const sharedBase = await this.sharedBasesService.disableSharedBaseLink({
      baseId,
    });

    return sharedBase;
  }

  @Get([
    '/api/v1/db/meta/projects/:baseId/shared',
    '/api/v1/meta/bases/:baseId/shared',
  ])
  @Acl('getSharedBaseLink')
  async getSharedBaseLink(
    @Request() req,
    @Param('baseId') baseId: string,
  ): Promise<any> {
    const sharedBase = await this.sharedBasesService.getSharedBaseLink({
      baseId: baseId,
      siteUrl: req.ncSiteUrl,
    });

    return sharedBase;
  }
}
