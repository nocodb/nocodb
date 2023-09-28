import {
  Body,
  Controller,
  HttpCode,
  Inject,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { BaseReqType } from 'nocodb-sdk';
import { GlobalGuard } from '~/guards/global/global.guard';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { NcError } from '~/helpers/catchError';
import { JobTypes } from '~/interface/Jobs';

@Controller()
@UseGuards(GlobalGuard)
export class BaseCreateController {
  constructor(@Inject('JobsService') private readonly jobsService) {}

  @Post('/api/v1/db/meta/projects/:projectId/bases')
  @HttpCode(200)
  @Acl('baseCreate')
  async baseCreate(
    @Param('projectId') projectId: string,
    @Body() body: BaseReqType,
  ) {
    const jobs = await this.jobsService.jobList();
    const fnd = jobs.find(
      (j) => j.name === JobTypes.BaseCreate && j.data.projectId === projectId,
    );

    if (fnd) {
      NcError.badRequest(
        'Another base creation is in progress for this project.',
      );
    }

    const job = await this.jobsService.add(JobTypes.BaseCreate, {
      projectId,
      base: body,
    });

    return { id: job.id };
  }
}
