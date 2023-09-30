import { Controller, Delete, Inject, Param, UseGuards } from '@nestjs/common';
import { GlobalGuard } from '~/guards/global/global.guard';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { NcError } from '~/helpers/catchError';
import { JobTypes } from '~/interface/Jobs';
import { BasesService } from '~/services/bases.service';

@Controller()
@UseGuards(GlobalGuard)
export class BaseDeleteController {
  constructor(
    @Inject('JobsService') private readonly jobsService,
    private readonly basesService: BasesService,
  ) {}

  @Delete('/api/v1/db/meta/projects/:projectId/bases/:baseId')
  @Acl('baseDelete')
  async baseDelete(@Param('baseId') baseId: string) {
    const jobs = await this.jobsService.jobList();
    const fnd = jobs.find(
      (j) => j.name === JobTypes.BaseDelete && j.data.baseId === baseId,
    );

    if (fnd) {
      NcError.badRequest('There is already a job running to delete this base.');
    }

    await this.basesService.baseSoftDelete({ baseId });

    const job = await this.jobsService.add(JobTypes.BaseDelete, {
      baseId,
    });

    return { id: job.id };
  }
}
