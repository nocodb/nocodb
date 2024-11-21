import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { SnapshotType } from 'nocodb-sdk';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { GlobalGuard } from '~/guards/global/global.guard';
import { SnapshotService } from '~/services/snapshot.service';
import { TenantContext } from '~/decorators/tenant-context.decorator';
import { NcContext } from '~/interface/config';

@UseGuards(MetaApiLimiterGuard, GlobalGuard)
@Controller()
export class SnapshotController {
  constructor(private readonly snapshotService: SnapshotService) {}

  // TODO: @DarkPhoenix2704 Add ACL
  @Get('/api/v2/meta/bases/:baseId/snapshots')
  async getSnapshots(
    @TenantContext() context: NcContext,
    @Param('baseId') baseId: string,
  ) {
    return await this.snapshotService.getSnapshots(context, baseId);
  }

  // TODO: @DarkPhoenix2704 Add ACL
  @Post('/api/v2/meta/bases/:baseId/snapshots')
  async createSnapshot(@TenantContext() context: NcContext) {
    return await this.snapshotService.createSnapshot();
  }

  // TODO: @DarkPhoenix2704 Add ACL
  @Patch('/api/v2/meta/bases/:baseId/snapshots/:snapshotId')
  async updateSnapshot(
    @TenantContext() context: NcContext,
    @Param('snapshotId') snapshotId: string,
    @Body() body: Pick<SnapshotType, 'title'>,
  ) {
    return await this.snapshotService.updateSnapshot(context, snapshotId, body);
  }

  // TODO: @DarkPhoenix2704 Add ACL
  @Post('/api/v2/meta/bases/:baseId/snapshots/:snapshotId/restore')
  async restoreSnapshot(
    @TenantContext() context: NcContext,
    @Param('snapshotId') snapshotId: string,
  ) {
    return await this.snapshotService.restoreSnapshot(context, snapshotId);
  }

  // TODO: @DarkPhoenix2704 Add ACL
  @Delete('/api/v2/meta/bases/:baseId/snapshots/:snapshotId')
  async deleteSnapshot(
    @TenantContext() context: NcContext,
    @Param('snapshotId') snapshotId: string,
    @Param('baseId') baseId: string,
  ) {
    return await this.snapshotService.deleteSnapshot(
      context,
      baseId,
      snapshotId,
    );
  }
}
