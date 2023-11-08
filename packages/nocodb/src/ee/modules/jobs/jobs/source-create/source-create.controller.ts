import axios from 'axios';
import { useAgent } from 'request-filtering-agent';
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
import { Request } from 'express';
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
    '/api/v1/db/meta/projects/:baseId/bases',
    '/api/v2/meta/bases/:baseId/sources',
  ])
  @HttpCode(200)
  @Acl('baseCreate')
  async baseCreate(
    @Param('baseId') baseId: string,
    @Body() body: BaseReqType,
    @Req() req: Request,
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

    if (process.env.NC_ALLOW_LOCAL_EXTERNAL_DBS !== 'true') {
      if (!body.config?.connection || !body.config?.connection.host) {
        NcError.badRequest('Connection missing host name or IP address');
      }
      if (body.config?.client && !body.config?.client.includes('sqlite')) {
        const host = body.config?.connection?.host;
        const port = body.config?.connection?.port;
        if (host && port) {
          const url = `${host.includes('://') ? '' : 'http://'}${host}:${port}`;
          await axios(url, {
            httpAgent: useAgent(url, {
              stopPortScanningByUrlRedirection: true,
            }),
            httpsAgent: useAgent(url, {
              stopPortScanningByUrlRedirection: true,
            }),
            timeout: 100,
          }).catch((err) => {
            if (err.message.includes('DNS lookup')) {
              NcError.badRequest('Forbidden!!!');
            }
          });
        }
      }
    }

    const job = await this.jobsService.add(JobTypes.SourceCreate, {
      baseId,
      source: body,
      user: req.user,
    });

    return { id: job.id };
  }
}
