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
import { GlobalGuard } from '~/guards/global/global.guard';
import { SharedBasesService } from '~/services/shared-bases.service';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { TenantContext } from '~/decorators/tenant-context.decorator';
import { NcContext, NcRequest } from '~/interface/config';

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
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Body() body: any,
    @Param('baseId') baseId: string,
  ): Promise<any> {
    const sharedBase = await this.sharedBasesService.createSharedBaseLink(
      context,
      {
        baseId: baseId,
        roles: body?.roles,
        password: body?.password,
        siteUrl: req.ncSiteUrl,
        req,
      },
    );

    return sharedBase;
  }

  @Patch([
    '/api/v1/db/meta/projects/:baseId/shared',
    '/api/v2/meta/bases/:baseId/shared',
  ])
  @Acl('updateSharedBaseLink')
  async updateSharedBaseLink(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Body() body: any,
    @Param('baseId') baseId: string,
  ): Promise<any> {
    const sharedBase = await this.sharedBasesService.updateSharedBaseLink(
      context,
      {
        baseId: baseId,
        roles: body?.roles,
        password: body?.password,
        siteUrl: req.ncSiteUrl,
        req,
        custom_url_path: body.custom_url_path,
      },
    );

    return sharedBase;
  }

  @Delete([
    '/api/v1/db/meta/projects/:baseId/shared',
    '/api/v2/meta/bases/:baseId/shared',
  ])
  @Acl('disableSharedBaseLink')
  async disableSharedBaseLink(
    @TenantContext() context: NcContext,
    @Param('baseId') baseId: string,
    @Req() req: NcRequest,
  ): Promise<any> {
    const sharedBase = await this.sharedBasesService.disableSharedBaseLink(
      context,
      {
        baseId,
        req,
      },
    );

    return sharedBase;
  }

  @Get([
    '/api/v1/db/meta/projects/:baseId/shared',
    '/api/v2/meta/bases/:baseId/shared',
  ])
  @Acl('getSharedBaseLink')
  async getSharedBaseLink(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('baseId') baseId: string,
  ): Promise<any> {
    const sharedBase = await this.sharedBasesService.getSharedBaseLink(
      context,
      {
        baseId: baseId,
        siteUrl: req.ncSiteUrl,
      },
    );

    return sharedBase;
  }
}
