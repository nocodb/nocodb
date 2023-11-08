import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { GlobalGuard } from '~/guards/global/global.guard';
import { SharedBasesService } from '~/services/shared-bases.service';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';

@Controller()
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class SharedBasesController {
  constructor(private readonly sharedBasesService: SharedBasesService) {}

  @Post([
    '/api/v1/db/meta/projects/:baseId/shared',
    '/api/v2/meta/bases/:baseId/shared',
  ])
  @HttpCode(200)
  @Acl('createSharedBaseLink')
  async createSharedBaseLink(
    @Req() req: Request,
    @Body() body: any,
    @Param('baseId') baseId: string,
  ): Promise<any> {
    const sharedBase = await this.sharedBasesService.createSharedBaseLink({
      baseId: baseId,
      roles: body?.roles,
      password: body?.password,
      siteUrl: req.ncSiteUrl,
      req,
    });

    return sharedBase;
  }

  @Patch([
    '/api/v1/db/meta/projects/:baseId/shared',
    '/api/v2/meta/bases/:baseId/shared',
  ])
  @Acl('updateSharedBaseLink')
  async updateSharedBaseLink(
    @Req() req: Request,
    @Body() body: any,
    @Param('baseId') baseId: string,
  ): Promise<any> {
    const sharedBase = await this.sharedBasesService.updateSharedBaseLink({
      baseId: baseId,
      roles: body?.roles,
      password: body?.password,
      siteUrl: req.ncSiteUrl,
      req,
    });

    return sharedBase;
  }

  @Delete([
    '/api/v1/db/meta/projects/:baseId/shared',
    '/api/v2/meta/bases/:baseId/shared',
  ])
  @Acl('disableSharedBaseLink')
  async disableSharedBaseLink(
    @Param('baseId') baseId: string,
    @Req() req: Request,
  ): Promise<any> {
    const sharedBase = await this.sharedBasesService.disableSharedBaseLink({
      baseId,
      req,
    });

    return sharedBase;
  }

  @Get([
    '/api/v1/db/meta/projects/:baseId/shared',
    '/api/v2/meta/bases/:baseId/shared',
  ])
  @Acl('getSharedBaseLink')
  async getSharedBaseLink(
    @Req() req: Request,
    @Param('baseId') baseId: string,
  ): Promise<any> {
    const sharedBase = await this.sharedBasesService.getSharedBaseLink({
      baseId: baseId,
      siteUrl: req.ncSiteUrl,
    });

    return sharedBase;
  }
}
