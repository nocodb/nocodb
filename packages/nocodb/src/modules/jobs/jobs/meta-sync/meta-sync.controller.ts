import {
  Controller,
  HttpCode,
  Inject,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { GlobalGuard } from '~/guards/global/global.guard';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { NcError } from '~/helpers/catchError';
import { JobTypes } from '~/interface/Jobs';

@Controller()
@UseGuards(GlobalGuard)
export class MetaSyncController {
  constructor(@Inject('JobsService') private readonly jobsService) {}

  @Post([
    '/api/v1/db/meta/projects/:baseId/meta-diff',
    '/api/v1/meta/bases/:baseId/meta-diff',
  ])
  @HttpCode(200)
  @Acl('metaDiffSync')
  async metaDiffSync(@Param('baseId') baseId: string, @Request() req) {
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
    });

    return { id: job.id };
  }

  @Post([
    '/api/v1/db/meta/projects/:baseId/meta-diff/:sourceId',
    '/api/v1/meta/bases/:baseId/meta-diff/:sourceId',
  ])
  @HttpCode(200)
  @Acl('baseMetaDiffSync')
  async baseMetaDiffSync(
    @Param('baseId') baseId: string,
    @Param('sourceId') sourceId: string,
    @Request() req,
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
    });

    return { id: job.id };
  }
}
