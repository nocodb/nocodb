import { Request, Router } from 'express';
// import { Queue } from 'bullmq';
// import axios from 'axios';
import catchError from '../../helpers/catchError';
import { Socket } from 'socket.io';
import NocoJobs from '../../../../noco-jobs/NocoJobs';
import job, { AirtableSyncConfig } from './helpers/job';
import SyncSource from '../../../../noco-models/SyncSource';
import Noco from '../../../Noco';
import * as jwt from 'jsonwebtoken';
const AIRTABLE_IMPORT_JOB = 'AIRTABLE_IMPORT_JOB';

enum SyncStatus {
  PROGRESS = 'PROGRESS',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED'
}

export default (router: Router, clients: { [id: string]: Socket }) => {
  NocoJobs.jobsMgr.addJobWorker(AIRTABLE_IMPORT_JOB, job);
  NocoJobs.jobsMgr.addProgressCbk(AIRTABLE_IMPORT_JOB, (payload, progress) => {
    clients?.[payload?.id]?.emit('progress', {
      msg: progress,
      status: SyncStatus.PROGRESS
    });
  });
  NocoJobs.jobsMgr.addSuccessCbk(AIRTABLE_IMPORT_JOB, payload => {
    clients?.[payload?.id]?.emit('progress', {
      msg: 'completed',
      status: SyncStatus.COMPLETED
    });
  });
  NocoJobs.jobsMgr.addFailureCbk(AIRTABLE_IMPORT_JOB, (payload, error: any) => {
    clients?.[payload?.id]?.emit('progress', {
      msg: error?.message || 'Failed due to some internal error',
      status: SyncStatus.FAILED
    });
  });

  router.post(
    '/api/v1/db/meta/import/airtable',
    catchError((req, res) => {
      NocoJobs.jobsMgr.add(AIRTABLE_IMPORT_JOB, {
        id: req.query.id,
        ...req.body
      });
      res.json({});
    })
  );
  router.post(
    '/api/v1/db/meta/syncs/:syncId/trigger',
    catchError(async (req: Request, res) => {
      const syncSource = await SyncSource.get(req.params.syncId);

      const user = await syncSource.getUser();
      const token = jwt.sign(
        {
          email: user.email,
          firstname: user.firstname,
          lastname: user.lastname,
          id: user.id,
          roles: user.roles
        },

        Noco.getConfig().auth.jwt.secret,
        Noco.getConfig().auth.jwt.options
      );

      NocoJobs.jobsMgr.add<AirtableSyncConfig>(AIRTABLE_IMPORT_JOB, {
        id: req.query.id,
        ...(syncSource?.details || {}),
        projectId: syncSource.project_id,
        authToken: token,
        baseURL: (req as any).ncSiteUrl
      });
      res.json({});
    })
  );
};
