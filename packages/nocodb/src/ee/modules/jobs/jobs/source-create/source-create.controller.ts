import {
  Body,
  Controller,
  HttpCode,
  Inject,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { BaseReqType } from 'nocodb-sdk';
import { GlobalGuard } from '~/guards/global/global.guard';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { NcError } from '~/helpers/catchError';
import { JobTypes } from '~/interface/Jobs';
import { Base } from '~/models';
import Noco from '~/Noco';
import { MetaTable } from '~/utils/globals';
import getWorkspaceForBase from '~/utils/getWorkspaceForBase';
import { getLimit, PlanLimitTypes } from '~/plan-limits';

@Controller()
@UseGuards(GlobalGuard)
export class SourceCreateController {
  constructor(@Inject('JobsService') private readonly jobsService) {}

  @Post([
    '/api/v1/db/meta/projects/:baseId/sources',
    '/api/v1/meta/bases/:baseId/sources',
  ])
  @HttpCode(200)
  @Acl('baseCreate')
  async baseCreate(
    @Param('baseId') baseId: string,
    @Body() body: BaseReqType,
    @Request() req,
  ) {
    const jobs = await this.jobsService.jobList();
    const fnd = jobs.find(
      (j) => j.name === JobTypes.BaseCreate && j.data.baseId === baseId,
    );

    if (fnd) {
      NcError.badRequest(
        'Another source creation is in progress for this base.',
      );
    }

    const base = await Base.get(baseId);

    if (!base) {
      NcError.notFound('Base not found');
    }

    const sourcesInBase = await Noco.ncMeta.metaCount(
      null,
      null,
      MetaTable.BASES,
      {
        condition: {
          base_id: base.id,
        },
      },
    );

    const workspaceId = await getWorkspaceForBase(base.id);

    const sourceLimitForWorkspace = await getLimit(
      PlanLimitTypes.SOURCE_LIMIT,
      workspaceId,
    );

    if (sourcesInBase >= sourceLimitForWorkspace) {
      NcError.badRequest(
        `Only ${sourceLimitForWorkspace} sources are allowed, for more please upgrade your plan`,
      );
    }

    const job = await this.jobsService.add(JobTypes.BaseCreate, {
      baseId,
      source: body,
      user: req.user,
    });

    return { id: job.id };
  }
}
