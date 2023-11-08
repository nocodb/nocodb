import {
  Controller,
  HttpCode,
  Inject,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { GlobalGuard } from '~/guards/global/global.guard';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { SyncSource } from '~/models';
import { NcError } from '~/helpers/catchError';
import { JobTypes } from '~/interface/Jobs';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';

@Controller()
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class AtImportController {
  constructor(@Inject('JobsService') private readonly jobsService) {}

  @Post([
    '/api/v1/db/meta/syncs/:syncId/trigger',
    '/api/v2/meta/syncs/:syncId/trigger',
  ])
  @Acl('airtableImport')
  @HttpCode(200)
  async triggerSync(@Req() req: Request) {
    const jobs = await this.jobsService.jobList();
    const fnd = jobs.find((j) => j.data.syncId === req.params.syncId);

    if (fnd) {
      NcError.badRequest('Sync already in progress');
    }

    const syncSource = await SyncSource.get(req.params.syncId);

    const user = await syncSource.getUser();

    // Treat default baseUrl as siteUrl from req object
    let baseURL = (req as any).ncSiteUrl;

    // if environment value avail use it
    // or if it's docker construct using `PORT`
    if (process.env.NC_DOCKER) {
      baseURL = `http://localhost:${process.env.PORT || 8080}`;
    }

    const job = await this.jobsService.add(JobTypes.AtImport, {
      syncId: req.params.syncId,
      ...(syncSource?.details || {}),
      baseId: syncSource.base_id,
      sourceId: syncSource.source_id,
      authToken: '',
      baseURL,
      user: user,
      req: {
        user: req.user,
        clientIp: req.clientIp,
        headers: req.headers,
      },
    });

    return { id: job.id };
  }

  @Post([
    '/api/v1/db/meta/syncs/:syncId/abort',
    '/api/v2/meta/syncs/:syncId/abort',
  ])
  @Acl('airtableImport')
  @HttpCode(200)
  async abortImport() {
    return {};
  }
}
