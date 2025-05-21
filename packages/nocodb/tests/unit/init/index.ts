import express from 'express';
import request from 'supertest';
import nocobuild from '../../../src/nocobuild';
// import { Noco } from '../../../src/lib';
import { createUser } from '../factory/user';
import cleanupMeta from './cleanupMeta';
import { cleanUpSakila, resetAndSeedSakila } from './cleanupSakila';

let server;

const serverInit = async () => {
  const serverInstance = express();
  serverInstance.enable('trust proxy');
  // serverInstance.use(await Noco.init());
  await nocobuild(serverInstance);
  serverInstance.use(function (req, res, next) {
    // 50 sec timeout
    req.setTimeout(500000, function () {
      console.log('Request has timed out.');
      res.send(408);
    });
    next();
  });
  return serverInstance;
};

const isFirstTimeRun = () => !server;

export default async function (forceReset = false, roles = 'editor') {
  const { default: TestDbMngr } = await import('../TestDbMngr');

  if (isFirstTimeRun()) {
    await resetAndSeedSakila();
    server = await serverInit();
  }

  // if (isSakila) {
  await cleanUpSakila(forceReset);
  // }
  await cleanupMeta();

  const { token, user } = await createUser({ app: server }, { roles });

  const extra: {
    fk_workspace_id?: string;
  } = {};

  // create ws for ee
  if (process.env.EE === 'true') {
    const ws = await request(server)
      .post('/api/v1/workspaces/')
      .set('xc-auth', token)
      .send({
        title: 'Workspace',
        meta: {
          color: '#146C8E',
        },
      });

    extra.fk_workspace_id = ws.body.id;
  }

  const xc_token = (
    await request(server)
      .post('/api/v1/tokens/')
      .set('xc-auth', token)
      .expect(200)
  ).body.token;

  return {
    app: server,
    token,
    xc_token,
    user,
    dbConfig: TestDbMngr.dbConfig,
    sakilaDbConfig: TestDbMngr.getSakilaDbConfig(),
    ...extra,
  };
}
