import {
  Body,
  Controller,
  HttpCode,
  Inject,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { BaseReqType } from 'nocodb-sdk';
import { GlobalGuard } from '~/guards/global/global.guard';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { NcError } from '~/helpers/catchError';
import { validateDbConnectionTargets } from '~/helpers/validateDbConnectionHost';
import { Integration } from '~/models';
import { JobTypes } from '~/interface/Jobs';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { IJobsService } from '~/modules/jobs/jobs-service.interface';
import { TenantContext } from '~/decorators/tenant-context.decorator';
import { NcContext, NcRequest } from '~/interface/config';

@Controller()
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class SourceCreateController {
  constructor(
    @Inject('JobsService') private readonly jobsService: IJobsService,
  ) {}

  @Post([
    '/api/v1/db/meta/projects/:baseId/bases',
    '/api/v2/meta/bases/:baseId/sources',
  ])
  @HttpCode(200)
  @Acl('sourceCreate')
  async baseCreate(
    @TenantContext() context: NcContext,
    @Param('baseId') baseId: string,
    @Body() body: BaseReqType,
    @Req() req: NcRequest,
  ) {
    const jobs = await this.jobsService.jobList();
    const fnd = jobs.find(
      (j) => j.name === JobTypes.SourceCreate && j.data.baseId === baseId,
    );

    if (fnd) {
      NcError.badRequest(
        'Another source creation is in progress for this base.',
      );
    }

    // SSRF: check every target the source will dial. An integration-backed
    // source dials the integration's config (Source.getConfig only takes
    // database/searchPath from the body), so check both.
    if (body?.fk_integration_id) {
      const integration = await Integration.get(
        context,
        body.fk_integration_id,
      );
      if (integration)
        await validateDbConnectionTargets(integration.getConfig());
    }
    if (body?.config) await validateDbConnectionTargets(body.config);

    const job = await this.jobsService.add(JobTypes.SourceCreate, {
      context,
      user: req.user,
      baseId,
      source: body,
      req,
    });

    return { id: job.id };
  }
}
