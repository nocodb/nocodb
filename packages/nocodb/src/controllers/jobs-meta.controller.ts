import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import type { JobStatus, JobTypes } from '~/interface/Jobs';
import { GlobalGuard } from '~/guards/global/global.guard';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { TenantContext } from '~/decorators/tenant-context.decorator';
import { NcContext, NcRequest } from '~/interface/config';
import { JobsMetaService } from '~/services/jobs-meta.service';

@Controller()
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class JobsMetaController {
  constructor(private readonly jobsMetaService: JobsMetaService) {}

  @Post(['/api/v2/jobs/:baseId'])
  // blockPublicBaseAccess: an anonymous shared-base link holder must not be able
  // to enumerate every user's job rows (ids + fk_user_id) for the base.
  @Acl('jobList', { blockPublicBaseAccess: true })
  async jobList(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Body()
    conditions?: {
      job?: JobTypes;
      status?: JobStatus;
    },
  ) {
    return await this.jobsMetaService.list(context, conditions, req);
  }
}
