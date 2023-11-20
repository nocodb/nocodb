import {
  Controller,
  HttpCode,
  Inject,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { GlobalGuard } from '~/guards/global/global.guard';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { NcError } from '~/helpers/catchError';
import { JobTypes } from '~/interface/Jobs';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';

@Controller()
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class MetaSyncController {
  constructor(@Inject('JobsService') private readonly jobsService) {}

  @Post([
    '/api/v1/db/meta/projects/:baseId/meta-diff',
    '/api/v2/meta/bases/:baseId/meta-diff',
  ])
  @HttpCode(200)
  @Acl('metaDiffSync')
  async metaDiffSync(@Param('baseId') baseId: string, @Req() req: Request) {
    const jobs = await this.jobsService.jobList();
    const fnd = jobs.find(
      (j) => j.name === JobTypes.MetaSync && j.data.baseId === baseId,
    );

    if (fnd) {
      NcError.badRequest('Meta sync already in progress for this base');
    }

    const job = await this.jobsService.add(JobTypes.MetaSync, {
      baseId,
      sourceId: 'all',
      user: req.user,
      req: {
        user: req.user,
        clientIp: req.clientIp,
        headers: req.headers,
      },
    });

    return { id: job.id };
  }

  @Post([
    '/api/v1/db/meta/projects/:baseId/meta-diff/:sourceId',
    '/api/v2/meta/bases/:baseId/meta-diff/:sourceId',
  ])
  @HttpCode(200)
  @Acl('baseMetaDiffSync')
  async baseMetaDiffSync(
    @Param('baseId') baseId: string,
    @Param('sourceId') sourceId: string,
    @Req() req: Request,
  ) {
    const jobs = await this.jobsService.jobList();
    const fnd = jobs.find(
      (j) =>
        j.name === JobTypes.MetaSync &&
        j.data.baseId === baseId &&
        (j.data.baseId === baseId || j.data.baseId === 'all'),
    );

    if (fnd) {
      NcError.badRequest('Meta sync already in progress for this base');
    }

    const job = await this.jobsService.add(JobTypes.MetaSync, {
      baseId,
      sourceId,
      user: req.user,
      req: {
        user: req.user,
        clientIp: req.clientIp,
        headers: req.headers,
      },
    });

    return { id: job.id };
  }
}
