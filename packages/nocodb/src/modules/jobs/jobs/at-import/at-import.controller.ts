import {
  Controller,
  HttpCode,
  Inject,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { GlobalGuard } from '~/guards/global/global.guard';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { SyncSource } from '~/models';
import { NcError } from '~/helpers/catchError';
import { JobTypes } from '~/interface/Jobs';

@Controller()
@UseGuards(GlobalGuard)
export class AtImportController {
  constructor(@Inject('JobsService') private readonly jobsService) {}

  @Post([
    '/api/v1/db/meta/syncs/:syncId/trigger',
    '/api/v1/meta/syncs/:syncId/trigger',
  ])
  @Acl('airtableImport')
  @HttpCode(200)
  async triggerSync(@Request() req) {
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
    });

    return { id: job.id };
  }

  @Post([
    '/api/v1/db/meta/syncs/:syncId/abort',
    '/api/v1/meta/syncs/:syncId/abort',
  ])
  @Acl('airtableImport')
  @HttpCode(200)
  async abortImport(@Request() _) {
    return {};
  }
}
