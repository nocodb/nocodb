// import { Queue } from 'bullmq';
// import axios from 'axios';
import catchError, { NcError } from '../../meta/helpers/catchError';
import NocoJobs from '../../jobs/NocoJobs';
import { SyncSource } from '../../models';
import Noco from '../../Noco';
import { syncService, userService } from '../../services';
import type { Server } from 'socket.io';
import type { Request, Router } from 'express';
import type { AirtableSyncConfig } from '../../services/sync/helpers/job';

const AIRTABLE_IMPORT_JOB = 'AIRTABLE_IMPORT_JOB';
const AIRTABLE_PROGRESS_JOB = 'AIRTABLE_PROGRESS_JOB';

enum SyncStatus {
  PROGRESS = 'PROGRESS',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export default (
  router: Router,
  sv: Server,
  jobs: { [id: string]: { last_message: any } }
) => {
  // add importer job handler and progress notification job handler
  NocoJobs.jobsMgr.addJobWorker(
    AIRTABLE_IMPORT_JOB,
    syncService.airtableImportJob
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
    }
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

  router.post(
    '/api/v1/db/meta/import/airtable',
    catchError((req, res) => {
      NocoJobs.jobsMgr.add(AIRTABLE_IMPORT_JOB, {
        id: req.query.id,
        ...req.body,
      });
      res.json({});
    })
  );
  router.post(
    '/api/v1/db/meta/syncs/:syncId/trigger',
    catchError(async (req: Request, res) => {
      if (req.params.syncId in jobs) {
        NcError.badRequest('Sync already in progress');
      }

      const syncSource = await SyncSource.get(req.params.syncId);

      const user = await syncSource.getUser();
      const token = userService.genJwt(user, Noco.getConfig());

      // Treat default baseUrl as siteUrl from req object
      let baseURL = (req as any).ncSiteUrl;

      // if environment value avail use it
      // or if it's docker construct using `PORT`
      if (process.env.NC_BASEURL_INTERNAL) {
        baseURL = process.env.NC_BASEURL_INTERNAL;
      } else if (process.env.NC_DOCKER) {
        baseURL = `http://localhost:${process.env.PORT || 8080}`;
      }

      setTimeout(() => {
        NocoJobs.jobsMgr.add<AirtableSyncConfig>(AIRTABLE_IMPORT_JOB, {
          id: req.params.syncId,
          ...(syncSource?.details || {}),
          projectId: syncSource.project_id,
          baseId: syncSource.base_id,
          authToken: token,
          baseURL,
          user: user,
        });
      }, 1000);

      jobs[req.params.syncId] = {
        last_message: {
          msg: 'Sync started',
        },
      };
      res.json({});
    })
  );
  router.post(
    '/api/v1/db/meta/syncs/:syncId/abort',
    catchError(async (req: Request, res) => {
      if (req.params.syncId in jobs) {
        delete jobs[req.params.syncId];
      }
      res.json({});
    })
  );
};
