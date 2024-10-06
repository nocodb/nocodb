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
import { BaseReqType, getTestDatabaseName, IntegrationsType } from 'nocodb-sdk';
import { GlobalGuard } from '~/guards/global/global.guard';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { NcError } from '~/helpers/catchError';
import { JobTypes } from '~/interface/Jobs';
import { Base, Integration } from '~/models';
import Noco from '~/Noco';
import { MetaTable } from '~/utils/globals';
import { getLimit, PlanLimitTypes } from '~/plan-limits';
import { NcContext, NcRequest } from '~/interface/config';
import { deepMerge } from '~/utils';
import { TenantContext } from '~/decorators/tenant-context.decorator';

@Controller()
@UseGuards(GlobalGuard)
export class SourceCreateController {
  constructor(@Inject('JobsService') private readonly jobsService) {}

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

    const base = await Base.get(context, baseId);

    if (!base) {
      NcError.baseNotFound(baseId);
    }

    const sourcesInBase = await Noco.ncMeta.metaCount(
      context.workspace_id,
      context.base_id,
      MetaTable.SOURCES,
      {
        condition: {
          base_id: base.id,
        },
      },
    );

    const sourceLimitForWorkspace = await getLimit(
      PlanLimitTypes.SOURCE_LIMIT,
      base.fk_workspace_id,
    );

    if (sourcesInBase >= sourceLimitForWorkspace) {
      NcError.badRequest(
        `Only ${sourceLimitForWorkspace} sources are allowed, for more please upgrade your plan`,
      );
    }

    let config = {
      ...body.config,
    };

    if (body.fk_integration_id) {
      const integration = await Integration.get(
        {
          workspace_id: req.ncWorkspaceId,
        },
        body.fk_integration_id,
      );

      if (!integration || integration.type !== IntegrationsType.Database) {
        NcError.integrationNotFound(body.fk_integration_id);
      }

      if (integration.is_private && integration.created_by !== req.user.id) {
        NcError.forbidden('You do not have access to this integration');
      }

      config = await integration.getConfig();

      if (config?.connection?.database) {
        config.connection.database = getTestDatabaseName(config);
      }

      deepMerge(config, body.config);
    }

    if (process.env.NC_ALLOW_LOCAL_EXTERNAL_DBS !== 'true') {
      if (
        config.client !== 'snowflake' &&
        (!config?.connection || !config?.connection.host)
      ) {
        NcError.badRequest('Connection missing host name or IP address');
      }
      if (config?.client && !config?.client.includes('sqlite')) {
        const host = config?.connection?.host;
        const port = config?.connection?.port;
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
      context,
      baseId,
      source: body,
      user: req.user,
    });

    return { id: job.id };
  }
}
