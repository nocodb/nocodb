import { Controller, Inject, Param, Post, UseGuards } from '@nestjs/common';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { GlobalGuard } from '~/guards/global/global.guard';
import { IJobsService } from '~/modules/jobs/jobs-service.interface';
import { TenantContext } from '~/decorators/tenant-context.decorator';
import { NcContext } from '~/interface/config';

@Controller()
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class SnapshotController {
  constructor(
    @Inject('JobsService') private readonly jobsService: IJobsService,
  ) {}

  // TODO: @DarkPhoenix2704 Add ACL
  @Post('/api/v2/meta/bases/:baseId/snapshots/:snapshotId/restore')
  async restoreSnapshot(
    @TenantContext() context: NcContext,
    @Param('snapshotId') snapshotId: string,
  ) {
    // return await this.snapshotService.restoreSnapshot(context, snapshotId);
  }

  // TODO: @DarkPhoenix2704 Add ACL
  @Post('/api/v2/meta/bases/:baseId/snapshots')
  async createSnapshot(@TenantContext() context: NcContext) {
    // return await this.snapshotService.createSnapshot();
  }
}
