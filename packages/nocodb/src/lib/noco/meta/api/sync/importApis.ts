import { Router } from 'express';
// import { Queue } from 'bullmq';
import axios from 'axios';
import catchError from '../../helpers/catchError';
import { Server, Socket } from 'socket.io';
import NocoJobs from '../../../../noco-jobs/NocoJobs';
const AIRTABLE_IMPORT_JOB = 'AIRTABLE_IMPORT_JOB';
// const worker = new Worker('test', async job => {
//   if (job.name === 'name') {
//     await executeJob(job.data);
//   }
// });

const clients: { [id: string]: Socket } = {};
const sleep = time => new Promise(resolve => setTimeout(resolve, time));

let count = 0;

async function executeJob(data: any, _cbk) {
  console.log('=======start=========' + ++count);

  const urls = [
    'https://google.com',
    'https://nocodb.com',
    'https://github.com'
  ];
  let c = 0;
  for (const url of urls) {
    ++c;
    const result = await axios(url);
    clients?.[data?.id]?.emit('progress', {
      step: c,
      msg: 'Extracted data from :  ' + url
    });
    console.log(url + ' : ' + result.status);
    await sleep(1000);
    clients?.[data?.id]?.emit('progress', {
      step: c,
      msg: 'Processed data from :  ' + url
    });
  }

  console.log('======= end =========' + count);
  clients?.[data?.id]?.emit('progress', { msg: 'completed' });
}

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

  NocoJobs.jobsMgr.addJobWorker(AIRTABLE_IMPORT_JOB, executeJob);
  NocoJobs.jobsMgr.addProgressCbk(AIRTABLE_IMPORT_JOB, (payload, progress) => {
    clients?.[payload?.id]?.emit('progress', {
      msg: progress
    });
  });
  NocoJobs.jobsMgr.addSuccessCbk(AIRTABLE_IMPORT_JOB, payload => {
    clients?.[payload?.id]?.emit('progress', {
      msg: 'completed'
    });
  });

  router.post(
    '/api/v1/db/meta/import/airtable',
    catchError((req, res) => {
      NocoJobs.jobsMgr.add('name', { id: req.query.id });
      res.json({});
    })
  );
};
