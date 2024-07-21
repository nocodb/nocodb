import {
  Controller,
  Delete,
  Inject,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import { GlobalGuard } from '~/guards/global/global.guard';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { NcError } from '~/helpers/catchError';
import { JobTypes } from '~/interface/Jobs';
import { SourcesService } from '~/services/sources.service';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { IJobsService } from '~/modules/jobs/jobs-service.interface';
import { TenantContext } from '~/decorators/tenant-context.decorator';
import { NcContext, NcRequest } from '~/interface/config';

@Controller()
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class SourceDeleteController {
  constructor(
    @Inject('JobsService') private readonly jobsService: IJobsService,
    private readonly sourcesService: SourcesService,
  ) {}

  @Delete([
    '/api/v1/db/meta/projects/:baseId/bases/:sourceId',
    '/api/v2/meta/bases/:baseId/sources/:sourceId',
  ])
  @Acl('baseDelete')
  async baseDelete(
    @TenantContext() context: NcContext,
    @Param('sourceId') sourceId: string,
    @Req() req: NcRequest,
  ) {
    const jobs = await this.jobsService.jobList();
    const fnd = jobs.find(
      (j) => j.name === JobTypes.SourceDelete && j.data.sourceId === sourceId,
    );

    if (fnd) {
      NcError.badRequest('There is already a job running to delete this base.');
    }

    await this.sourcesService.baseSoftDelete(context, { sourceId });

    const job = await this.jobsService.add(JobTypes.SourceDelete, {
      context,
      user: req.user,
      sourceId,
      req: {
        user: req.user,
        clientIp: req.clientIp,
        headers: req.headers,
      },
    });

    return { id: job.id };
  }
}
