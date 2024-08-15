import debug from 'debug';
import { Injectable } from '@nestjs/common';
import type { Job } from 'bull';
import { SourcesService } from '~/services/sources.service';

@Injectable()
export class SourceDeleteProcessor {
  private readonly debugLog = debug('nc:jobs:source-delete');

  constructor(private readonly sourcesService: SourcesService) {}

  async job(job: Job) {
    this.debugLog(`job started for ${job.id}`);

    const { context, sourceId, req } = job.data;

    await this.sourcesService.baseDelete(context, {
      sourceId,
      req,
    });

    this.debugLog(`job completed for ${job.id}`);
  }
}
