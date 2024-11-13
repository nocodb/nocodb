import debug from 'debug';
import { Injectable } from '@nestjs/common';
import type { Job } from 'bull';
import { SourcesService } from '~/services/sources.service';
import { JobsLogService } from '~/modules/jobs/jobs/jobs-log.service';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';

@Injectable()
export class SourceCreateProcessor {
  private readonly debugLog = debug('nc:jobs:source-create');

  constructor(
    private readonly sourcesService: SourcesService,
    private readonly jobsLogService: JobsLogService,
    private readonly appHooksService: AppHooksService,
  ) {}

  async job(job: Job) {
    this.debugLog(`job started for ${job.id}`);

    const { context, baseId, source, req, user } = job.data;

    const logBasic = (log) => {
      this.jobsLogService.sendLog(job, { message: log });
      this.debugLog(log);
    };

    const { source: createdSource, error } =
      await this.sourcesService.baseCreate(context, {
        baseId,
        source,
        logger: logBasic,
        req,
      });

    if (error) {
      await this.sourcesService.baseDelete(context, {
        sourceId: createdSource.id,
        req: { user: user || req.user || {} },
      });
      throw error;
    }

    if (createdSource.isMeta()) {
      delete createdSource.config;
    }

    this.debugLog(`job completed for ${job.id}`);
  }
}
