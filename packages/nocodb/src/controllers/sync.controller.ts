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
import { SyncService } from '~/services/sync.service';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { TenantContext } from '~/decorators/tenant-context.decorator';
import { NcContext, NcRequest } from '~/interface/config';

@Controller()
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Get([
    '/api/v1/db/meta/projects/:baseId/syncs',
    '/api/v1/db/meta/projects/:baseId/syncs/:sourceId',
    '/api/v2/meta/bases/:baseId/syncs',
    '/api/v2/meta/bases/:baseId/syncs/:sourceId',
  ])
  @Acl('syncSourceList')
  async syncSourceList(
    @TenantContext() context: NcContext,
    @Param('baseId') baseId: string,
    @Param('sourceId') sourceId?: string,
  ) {
    return await this.syncService.syncSourceList(context, {
      baseId,
      sourceId,
    });
  }

  @Post([
    '/api/v1/db/meta/projects/:baseId/syncs',
    '/api/v1/db/meta/projects/:baseId/syncs/:sourceId',
    '/api/v2/meta/bases/:baseId/syncs',
    '/api/v2/meta/bases/:baseId/syncs/:sourceId',
  ])
  @HttpCode(200)
  @Acl('syncSourceCreate')
  async syncCreate(
    @TenantContext() context: NcContext,
    @Param('baseId') baseId: string,
    @Body() body: any,
    @Req() req: NcRequest,
    @Param('sourceId') sourceId?: string,
  ) {
    return await this.syncService.syncCreate(context, {
      baseId: baseId,
      sourceId: sourceId,
      userId: (req as any).user.id,
      syncPayload: body,
      req,
    });
  }

  @Delete(['/api/v1/db/meta/syncs/:syncId', '/api/v2/meta/syncs/:syncId'])
  @Acl('syncSourceDelete')
  async syncDelete(
    @TenantContext() context: NcContext,
    @Param('syncId') syncId: string,
    @Req() req: NcRequest,
  ) {
    return await this.syncService.syncDelete(context, {
      syncId: syncId,
      req,
    });
  }

  @Patch(['/api/v1/db/meta/syncs/:syncId', '/api/v2/meta/syncs/:syncId'])
  @Acl('syncSourceUpdate')
  async syncUpdate(
    @TenantContext() context: NcContext,
    @Param('syncId') syncId: string,
    @Body() body: any,
    @Req() req: NcRequest,
  ) {
    return await this.syncService.syncUpdate(context, {
      syncId: syncId,
      syncPayload: body,
      req,
    });
  }
}
