import { Controller, HttpCode, Post, Request, UseGuards } from '@nestjs/common';
import { forwardRef, Inject } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { GlobalGuard } from '../../guards/global/global.guard';
import { NcError } from '../../helpers/catchError';
import { ExtractProjectIdMiddleware } from '../../middlewares/extract-project-id/extract-project-id.middleware';
import { SyncSource } from '../../models';
import NocoJobs from '../../jobs/NocoJobs';
import { SocketService } from '../../services/client/socket.service';
import { ImportService } from './import.service';
import type { AirtableSyncConfig } from '../sync/helpers/job';
import airtableSyncJob from '../sync/helpers/job';

import type { Server } from 'socket.io';

const AIRTABLE_IMPORT_JOB = 'AIRTABLE_IMPORT_JOB';
const AIRTABLE_PROGRESS_JOB = 'AIRTABLE_PROGRESS_JOB';

enum SyncStatus {
  PROGRESS = 'PROGRESS',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

const jobs = [];
const initJob = (sv: Server, jobs: { [p: string]: { last_message: any } }, socketService: SocketService) => {
  // add importer job handler and progress notification job handler
  NocoJobs.jobsMgr.addJobWorker(
    AIRTABLE_IMPORT_JOB,
    airtableSyncJob
  );
  NocoJobs.jobsMgr.addJobWorker(
    AIRTABLE_PROGRESS_JOB,
    ({ payload, progress }) => {
      socketService.io.to(payload?.id).emit('progress', {
        msg: progress?.msg,
        level: progress?.level,
        status: progress?.status,
      });

      if (payload?.id in jobs) {
        jobs[payload?.id].last_message = {
          msg: progress?.msg,
          level: progress?.level,
          status: progress?.status,
        };
      }
    },
  );

  NocoJobs.jobsMgr.addProgressCbk(AIRTABLE_IMPORT_JOB, (payload, progress) => {
    NocoJobs.jobsMgr.add(AIRTABLE_PROGRESS_JOB, {
      payload,
      progress: {
        msg: progress?.msg,
        level: progress?.level,
        status: progress?.status,
      },
    });
  });
  NocoJobs.jobsMgr.addSuccessCbk(AIRTABLE_IMPORT_JOB, (payload) => {
    NocoJobs.jobsMgr.add(AIRTABLE_PROGRESS_JOB, {
      payload,
      progress: {
        msg: 'Complete!',
        status: SyncStatus.COMPLETED,
      },
    });
    delete jobs[payload?.id];
  });
  NocoJobs.jobsMgr.addFailureCbk(AIRTABLE_IMPORT_JOB, (payload, error: any) => {
    NocoJobs.jobsMgr.add(AIRTABLE_PROGRESS_JOB, {
      payload,
      progress: {
        msg: error?.message || 'Failed due to some internal error',
        status: SyncStatus.FAILED,
      },
    });
    delete jobs[payload?.id];
  });
};
@Controller()
@UseGuards(ExtractProjectIdMiddleware, GlobalGuard)
export class ImportController {
  constructor(
    private readonly importService: ImportService,
    private readonly socketService: SocketService,
    @Inject(forwardRef(() => ModuleRef)) private readonly moduleRef: ModuleRef,
  ) {}

  @Post('/api/v1/db/meta/import/airtable')
  @HttpCode(200)
  importAirtable(@Request() req) {
    NocoJobs.jobsMgr.add(AIRTABLE_IMPORT_JOB, {
      id: req.query.id,
      ...req.body,
    });
    return {};
  }

  @Post('/api/v1/db/meta/syncs/:syncId/trigger')
  @HttpCode(200)
  async triggerSync(@Request() req) {
    if (req.params.syncId in jobs) {
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

    setTimeout(() => {
      NocoJobs.jobsMgr.add<AirtableSyncConfig>(AIRTABLE_IMPORT_JOB, {
        id: req.params.syncId,
        ...(syncSource?.details || {}),
        projectId: syncSource.project_id,
        baseId: syncSource.base_id,
        authToken: '',
        baseURL,
        user: user,
        moduleRef: this.moduleRef,
      });
    }, 1000);

    jobs[req.params.syncId] = {
      last_message: {
        msg: 'Sync started',
      },
    };
    return {};
  }

  @Post('/api/v1/db/meta/syncs/:syncId/abort')
  @HttpCode(200)
  async abortImport(@Request() req) {
    if (req.params.syncId in jobs) {
      delete jobs[req.params.syncId];
    }
    return {};
  }

  async onModuleInit() {
    initJob(this.socketService.io, this.socketService.jobs, this.socketService);
  }
}
