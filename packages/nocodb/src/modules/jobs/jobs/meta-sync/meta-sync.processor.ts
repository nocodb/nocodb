import debug from 'debug';
import { Injectable } from '@nestjs/common';
import type { Job } from 'bull';
import type { NcContext, NcRequest } from '~/interface/config';
import { MetaDiffsService } from '~/services/meta-diffs.service';

@Injectable()
export class MetaSyncProcessor {
  private readonly debugLog = debug('nc:jobs:meta-sync');

  constructor(private readonly metaDiffsService: MetaDiffsService) {}

  async job(job: Job) {
    this.debugLog(`job started for ${job.id}`);

    const info: {
      context: NcContext;
      sourceId: string;
      user: any;
      req: NcRequest;
    } = job.data;

    const context = info.context;
    const baseId = context.base_id;

    if (info.sourceId === 'all') {
      await this.metaDiffsService.metaDiffSync(context, {
        baseId: baseId,
        req: info.req,
      });
    } else {
      await this.metaDiffsService.baseMetaDiffSync(context, {
        baseId: baseId,
        sourceId: info.sourceId,
        req: info.req,
      });
    }

    this.debugLog(`job completed for ${job.id}`);
  }
}
