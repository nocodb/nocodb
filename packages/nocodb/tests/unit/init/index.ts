import express from 'express';
import request from 'supertest';
import nocobuild from '../../../src/nocobuild';
// import { Noco } from '../../../src/lib';
import { createUser } from '../factory/user';
import cleanupMeta from './cleanupMeta';
import { cleanUpSakila, resetAndSeedSakila } from './cleanupSakila';
import type { INestApplication } from '@nestjs/common';

let server;
let nestApp: INestApplication<any>;

const serverInit = async () => {
  const serverInstance = express();
  serverInstance.enable('trust proxy');
  // serverInstance.use(await Noco.init());
  const { nestApp } = await nocobuild(serverInstance);
  serverInstance.use(function (req, res, next) {
    // 50 sec timeout
    req.setTimeout(500000, function () {
      console.log('Request has timed out.');
      res.send(408);
    });
    next();
  });
  return { serverInstance, nestApp };
};

const isFirstTimeRun = () => !server;

export default async function (forceReset = false, roles = 'editor') {
  const { default: TestDbMngr } = await import('../TestDbMngr');

  if (isFirstTimeRun()) {
    await resetAndSeedSakila();
    const serverInitResult = await serverInit();
    server = serverInitResult.serverInstance;
    nestApp = serverInitResult.nestApp;
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
    nestApp,
    token,
    xc_token,
    user,
    dbConfig: TestDbMngr.dbConfig,
    sakilaDbConfig: TestDbMngr.getSakilaDbConfig(),
    ...extra,
  };
}
