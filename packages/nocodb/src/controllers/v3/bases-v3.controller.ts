import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { BaseCreateV3Type, BaseUpdateV3Type } from 'nocodb-sdk';
import { GlobalGuard } from '~/guards/global/global.guard';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { TenantContext } from '~/decorators/tenant-context.decorator';
import { NcContext, NcRequest } from '~/interface/config';
import { BasesV3Service } from '~/services/v3/bases-v3.service';

@UseGuards(MetaApiLimiterGuard, GlobalGuard)
@Controller()
export class BasesV3Controller {
  constructor(protected readonly baseV3Service: BasesV3Service) {}

  @Acl('baseList', {
    scope: 'org',
  })
  @Get('/api/v3/meta/workspaces/:workspaceId/bases')
  async list(
    @TenantContext() context: NcContext,
    @Query() queryParams: Record<string, any>,
    @Req() req: NcRequest,
    @Param('workspaceId') workspaceId: string,
  ) {
    const bases = await this.baseV3Service.baseList(context, {
      user: req.user,
      query: queryParams,
      workspaceId,
    });
    return { list: bases };
  }

  @Acl('baseGet')
  @Get('/api/v3/meta/bases/:baseId')
  async baseGet(
    @TenantContext() context: NcContext,
    @Param('baseId') baseId: string,
  ) {
    const base = await this.baseV3Service.getProjectWithInfo(context, {
      baseId: baseId,
      includeConfig: false,
    });

    return base;
  }

  @Acl('baseUpdate')
  @Patch('/api/v3/meta/bases/:baseId')
  async baseUpdate(
    @TenantContext() context: NcContext,
    @Param('baseId') baseId: string,
    @Body() body: BaseUpdateV3Type,
    @Req() req: NcRequest,
  ) {
    const base = await this.baseV3Service.baseUpdate(context, {
      baseId,
      base: body,
      user: req.user,
      req,
    });

    return base;
  }

  @Acl('baseDelete')
  @Delete('/api/v3/meta/bases/:baseId')
  async baseDelete(
    @TenantContext() context: NcContext,
    @Param('baseId') baseId: string,
    @Req() req: NcRequest,
  ) {
    const deleted = await this.baseV3Service.baseSoftDelete(context, {
      baseId,
      user: req.user,
      req,
    });

    return deleted;
  }

  @Acl('baseCreate', {
    scope: 'org',
  })
  @Post('/api/v3/meta/workspaces/:workspaceId/bases')
  async baseCreate(
    @TenantContext() context: NcContext,
    @Body() baseBody: BaseCreateV3Type,
    @Req() req: NcRequest,
    @Param('workspaceId') workspaceId: string,
  ) {
    const base = await this.baseV3Service.baseCreate({
      base: baseBody,
      req,
      user: req['user'],
      workspaceId,
    });

    return base;
  }
}
