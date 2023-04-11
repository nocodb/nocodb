import { Controller, Post, Request } from '@nestjs/common';
import type { Server } from 'socket.io';
import { NcError } from '../../helpers/catchError';
import { SyncSource } from '../../models';
import { AirtableSyncConfig } from '../sync/helpers/job';
import { ImportService } from './import.service';
import { Router } from 'express';
import NocoJobs from 'src/jobs/NocoJobs';

import { Inject, forwardRef } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';

const AIRTABLE_IMPORT_JOB = 'AIRTABLE_IMPORT_JOB';
const AIRTABLE_PROGRESS_JOB = 'AIRTABLE_PROGRESS_JOB';

enum SyncStatus {
  PROGRESS = 'PROGRESS',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

const jobs = [];
export default (
  router: Router,
  sv: Server,
  jobs: { [id: string]: { last_message: any } },
) => {
  // add importer job handler and progress notification job handler
  NocoJobs.jobsMgr.addJobWorker(
    AIRTABLE_IMPORT_JOB,
    {} as any, // this?.syncService?.airtableImportJob,
  );
  NocoJobs.jobsMgr.addJobWorker(
    AIRTABLE_PROGRESS_JOB,
    ({ payload, progress }) => {
      sv.to(payload?.id).emit('progress', {
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
export class ImportController {
  constructor(
    private readonly importService: ImportService,
    @Inject(forwardRef(() => ModuleRef)) private readonly moduleRef: ModuleRef,
  ) {}

  @Post('/api/v1/db/meta/import/airtable')
  importAirtable(@Request() req) {
    NocoJobs.jobsMgr.add(AIRTABLE_IMPORT_JOB, {
      id: req.query.id,
      ...req.body,
    });
    return {};
  }

  @Post('/api/v1/db/meta/syncs/:syncId/trigger')
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
  async abortImport(@Request() req) {
    if (req.params.syncId in jobs) {
      delete jobs[req.params.syncId];
    }
    return {};
  }
}
