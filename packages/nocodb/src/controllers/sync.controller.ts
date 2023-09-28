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

@Controller()
@UseGuards(GlobalGuard)
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Get([
    '/api/v1/db/meta/projects/:baseId/syncs',
    '/api/v1/db/meta/projects/:baseId/syncs/:sourceId',
    '/api/v1/meta/bases/:baseId/syncs',
    '/api/v1/meta/bases/:baseId/syncs/:sourceId',
  ])
  @Acl('syncSourceList')
  async syncSourceList(
    @Param('baseId') baseId: string,
    @Param('sourceId') sourceId?: string,
  ) {
    return await this.syncService.syncSourceList({
      baseId,
      sourceId,
    });
  }

  @Post([
    '/api/v1/db/meta/projects/:baseId/syncs',
    '/api/v1/db/meta/projects/:baseId/syncs/:sourceId',
    '/api/v1/meta/bases/:baseId/syncs',
    '/api/v1/meta/bases/:baseId/syncs/:sourceId',
  ])
  @HttpCode(200)
  @Acl('syncSourceCreate')
  async syncCreate(
    @Param('baseId') baseId: string,
    @Body() body: any,
    @Req() req,
    @Param('sourceId') sourceId?: string,
  ) {
    return await this.syncService.syncCreate({
      baseId: baseId,
      sourceId: sourceId,
      userId: (req as any).user.id,
      syncPayload: body,
    });
  }

  @Delete(['/api/v1/db/meta/syncs/:syncId', '/api/v1/meta/syncs/:syncId'])
  @Acl('syncSourceDelete')
  async syncDelete(@Param('syncId') syncId: string) {
    return await this.syncService.syncDelete({
      syncId: syncId,
    });
  }

  @Patch(['/api/v1/db/meta/syncs/:syncId', '/api/v1/meta/syncs/:syncId'])
  @Acl('syncSourceUpdate')
  async syncUpdate(@Param('syncId') syncId: string, @Body() body: any) {
    return await this.syncService.syncUpdate({
      syncId: syncId,
      syncPayload: body,
    });
  }
}
