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
import { validateDbConnectionHost } from '~/helpers/validateDbConnectionHost';
import { getValidatableSourceCreateHost } from '~/helpers/dbConnectionHost.utils';
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

    // SSRF: range-check the connection host before creating the source, matching
    // the test-connection / EE paths (only those validated before — GHSA-m4v9).
    // Integration-backed sources (fk_integration_id) carry the routable host in
    // the integration config — merged in at connect time via Source.getConfig,
    // not present in body.config — so resolve the integration config first to
    // reach parity with the EE controller. No-op for host-less clients
    // (sqlite/snowflake); self-hosted can bypass via NC_ALLOW_LOCAL_EXTERNAL_DBS,
    // which validateDbConnectionHost honours.
    let integrationConfig:
      | { client?: string; connection?: { host?: unknown } }
      | undefined;
    if (body?.fk_integration_id) {
      const integration = await Integration.get(
        context,
        body.fk_integration_id,
      );
      integrationConfig = integration?.getConfig();
    }

    const host = getValidatableSourceCreateHost(
      body?.config,
      integrationConfig,
    );
    if (host) {
      await validateDbConnectionHost(host);
    }

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
