import debug from 'debug';
import { Injectable } from '@nestjs/common';
import { EventType } from 'nocodb-sdk';
import type { Job } from 'bull';
import type { NcContext, NcRequest } from '~/interface/config';
import { MetaDiffsService } from '~/services/meta-diffs.service';
import { JobsLogService } from '~/modules/jobs/jobs/jobs-log.service';
import NocoSocket from '~/socket/NocoSocket';

@Injectable()
export class MetaSyncProcessor {
  private readonly debugLog = debug('nc:jobs:meta-sync');

  constructor(
    private readonly metaDiffsService: MetaDiffsService,
    private readonly jobsLogService: JobsLogService,
  ) {}

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

    const logBasic = (log) => {
      this.jobsLogService.sendLog(job, { message: log });
      this.debugLog(log);
    };

    if (info.sourceId === 'all') {
      await this.metaDiffsService.metaDiffSync(context, {
        baseId: baseId,
        logger: logBasic,
        req: info.req,
      });
    } else {
      await this.metaDiffsService.baseMetaDiffSync(context, {
        baseId: baseId,
        sourceId: info.sourceId,
        logger: logBasic,
        req: info.req,
      });
    }

    NocoSocket.broadcastEvent(
      context,
      {
        event: EventType.META_EVENT,
        payload: {
          action: 'source_meta_sync',
          payload: {
            base_id: baseId,
            source_id: info.sourceId,
          },
        },
      },
      context.socket_id,
    );

    this.debugLog(`job completed for ${job.id}`);
  }

  async metaDiffJob(job: Job) {
    this.debugLog(`job started for ${job.id}`);

    const info: {
      context: NcContext;
      sourceId: string;
      user: any;
      req: NcRequest;
    } = job.data;

    const context = info.context;
    const baseId = context.base_id;

    let result = null;

    if (info.sourceId === 'all') {
      result = await this.metaDiffsService.metaDiff(context, {
        baseId,
      });
    } else {
      result = await this.metaDiffsService.baseMetaDiff(context, {
        sourceId: info.sourceId,
        baseId,
        user: info.req.user,
      });
    }

    this.debugLog(`job completed for ${job.id}`);

    return result;
  }
}
