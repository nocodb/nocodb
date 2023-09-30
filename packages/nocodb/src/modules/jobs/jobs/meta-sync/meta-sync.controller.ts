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

  @Post('/api/v1/db/meta/projects/:projectId/meta-diff')
  @HttpCode(200)
  @Acl('metaDiffSync')
  async metaDiffSync(@Param('projectId') projectId: string, @Request() req) {
    const jobs = await this.jobsService.jobList();
    const fnd = jobs.find(
      (j) => j.name === JobTypes.MetaSync && j.data.projectId === projectId,
    );

    if (fnd) {
      NcError.badRequest('Meta sync already in progress for this project');
    }

    const job = await this.jobsService.add(JobTypes.MetaSync, {
      projectId,
      baseId: 'all',
      user: req.user,
    });

    return { id: job.id };
  }

  @Post('/api/v1/db/meta/projects/:projectId/meta-diff/:baseId')
  @HttpCode(200)
  @Acl('baseMetaDiffSync')
  async baseMetaDiffSync(
    @Param('projectId') projectId: string,
    @Param('baseId') baseId: string,
    @Request() req,
  ) {
    const jobs = await this.jobsService.jobList();
    const fnd = jobs.find(
      (j) =>
        j.name === JobTypes.MetaSync &&
        j.data.projectId === projectId &&
        (j.data.baseId === baseId || j.data.baseId === 'all'),
    );

    if (fnd) {
      NcError.badRequest('Meta sync already in progress for this project');
    }

    const job = await this.jobsService.add(JobTypes.MetaSync, {
      projectId,
      baseId,
      user: req.user,
    });

    return { id: job.id };
  }
}
