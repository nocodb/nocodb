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
import { GlobalGuard } from '../../guards/global/global.guard';
import {
  Acl,
  ExtractProjectIdMiddleware,
} from '../../middlewares/extract-project-id/extract-project-id.middleware';
import { SyncService } from './sync.service';

@Controller()
@UseGuards(ExtractProjectIdMiddleware, GlobalGuard)
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Get([
    '/api/v1/db/meta/projects/:projectId/syncs',
    '/api/v1/db/meta/projects/:projectId/syncs/:baseId',
  ])
  @Acl('syncSourceList')
  async syncSourceList(
    @Param('projectId') projectId: string,
    @Param('baseId') baseId?: string,
  ) {
    return await this.syncService.syncSourceList({
      projectId,
      baseId,
    });
  }

  @Post([
    '/api/v1/db/meta/projects/:projectId/syncs',
    '/api/v1/db/meta/projects/:projectId/syncs/:baseId',
  ])
  @HttpCode(200)
  @Acl('syncSourceCreate')
  async syncCreate(
    @Param('projectId') projectId: string,
    @Body() body: any,
    @Req() req,
    @Param('baseId') baseId?: string,
  ) {
    return await this.syncService.syncCreate({
      projectId: projectId,
      baseId: baseId,
      userId: (req as any).user.id,
      syncPayload: body,
    });
  }

  @Delete('/api/v1/db/meta/syncs/:syncId')
  @Acl('syncSourceDelete')
  async syncDelete(@Param('syncId') syncId: string) {
    return await this.syncService.syncDelete({
      syncId: syncId,
    });
  }

  @Patch('/api/v1/db/meta/syncs/:syncId')
  async syncUpdate(@Param('syncId') syncId: string, @Body() body: any) {
    return await this.syncService.syncUpdate({
      syncId: syncId,
      syncPayload: body,
    });
  }
}
