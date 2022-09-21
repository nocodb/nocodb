
import express from 'express';
import { Noco } from '../../../src/lib';

import cleanupMeta from './cleanupMeta';
import {cleanUpSakila, resetAndSeedSakila} from './cleanupSakila';
import { createUser } from '../factory/user';

let server;

const serverInit = async () => {
  const serverInstance = express();
  serverInstance.enable('trust proxy');
  serverInstance.use(await Noco.init());
  serverInstance.use(function(req, res, next){
    // 50 sec timeout
    req.setTimeout(500000, function(){
        console.log('Request has timed out.');
        res.send(408);
    });
    next();
});
  return serverInstance;
};

const isFirstTimeRun = () => !server

export default async function () {  
  const {default: TestDbMngr} = await import('../TestDbMngr');

  if (isFirstTimeRun()) {
    await resetAndSeedSakila();
    server = await serverInit();
  }

  await cleanUpSakila();
  await cleanupMeta();

  const { token } = await createUser({ app: server }, { roles: 'editor' });

  return { app: server, token, dbConfig: TestDbMngr.dbConfig, sakilaDbConfig: TestDbMngr.getSakilaDbConfig() };
}
