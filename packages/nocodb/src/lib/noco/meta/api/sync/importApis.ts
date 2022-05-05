import { Request, Router } from 'express';
// import { Queue } from 'bullmq';
// import axios from 'axios';
import catchError from '../../helpers/catchError';
import { Server, Socket } from 'socket.io';
import NocoJobs from '../../../../noco-jobs/NocoJobs';
import job from './helpers/job';
import SyncSource from '../../../../noco-models/SyncSource';
const AIRTABLE_IMPORT_JOB = 'AIRTABLE_IMPORT_JOB';

enum SyncStatus {
  PROGRESS = 'PROGRESS',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED'
}

// const worker = new Worker('test', async job => {
//   if (job.name === 'name') {
//     await executeJob(job.data);
//   }
// });

const clients: { [id: string]: Socket } = {};
// const sleep = time => new Promise(resolve => setTimeout(resolve, time));
//
// const count = 0;

// async function executeJob(data: any, _cbk) {
//   console.log('=======start=========' + ++count);
//
//   const urls = [
//     'https://google.com',
//     'https://nocodb.com',
//     'https://github.com'
//   ];
//   let c = 0;
//   for (const url of urls) {
//     ++c;
//     const result = await axios(url);
//     clients?.[data?.id]?.emit('progress', {
//       step: c,
//       msg: 'Extracted data from :  ' + url
//     });
//     console.log(url + ' : ' + result.status);
//     await sleep(1000);
//     clients?.[data?.id]?.emit('progress', {
//       step: c,
//       msg: 'Processed data from :  ' + url
//     });
//   }
//
//   console.log('======= end =========' + count);
//   clients?.[data?.id]?.emit('progress', { msg: 'completed' });
// }

// const queue = new Queue('test');

export default (router: Router, _server) => {
  const io = new Server(9000, {
    cors: {
      origin: '*',
      allowedHeaders: ['xc-auth'],
      credentials: true
    }
  });

  io.on('connection', socket => {
    clients[socket.id] = socket;
  });

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
  NocoJobs.jobsMgr.addFailureCbk(AIRTABLE_IMPORT_JOB, (payload, ..._rest) => {
    clients?.[payload?.id]?.emit('progress', {
      msg: 'failed',
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

      NocoJobs.jobsMgr.add(AIRTABLE_IMPORT_JOB, {
        id: req.query.id,
        ...(syncSource?.details || {}),
        projectId: syncSource.project_id,
        authToken: req.headers['xc-auth']
      });
      res.json({});
    })
  );
};
