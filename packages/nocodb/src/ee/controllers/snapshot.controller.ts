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
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';

@UseGuards(MetaApiLimiterGuard, GlobalGuard)
@Controller()
export class SnapshotController {
  constructor(private readonly snapshotService: SnapshotService) {}

  @Acl('manageSnapshots')
  @Get('/api/v2/meta/bases/:baseId/snapshots')
  async getSnapshots(
    @TenantContext() context: NcContext,
    @Param('baseId') baseId: string,
  ) {
    return await this.snapshotService.getSnapshots(context, baseId);
  }

  @Acl('manageSnapshots')
  @Patch('/api/v2/meta/bases/:baseId/snapshots/:snapshotId')
  async updateSnapshot(
    @TenantContext() context: NcContext,
    @Param('snapshotId') snapshotId: string,
    @Body() body: Pick<SnapshotType, 'title'>,
  ) {
    return await this.snapshotService.updateSnapshot(context, snapshotId, body);
  }

  @Acl('manageSnapshots')
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
