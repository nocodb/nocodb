
import express from 'express';
import { Noco } from '../../../src/lib';
import cleanupMeta from './cleanupMeta';
import {cleanUpSakila, resetAndSeedSakila} from './cleanupSakila';
import { createUser } from '../factory/user';
import { DbConfig } from '../../../src/interface/config';
import { UserType } from 'nocodb-sdk';
import NocoCache from '../../../src/lib/cache/NocoCache';

let server;

export interface NcUnitContext {
  app: express.Application;
  token: string;
  dbConfig: DbConfig;
  sakilaDbConfig: DbConfig;
  user: UserType;
}

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

  NocoCache.init();
  await NocoCache.destroy();
  NocoCache.init();

  if (isFirstTimeRun()) {
    await resetAndSeedSakila();
    server = await serverInit();
  }

  await cleanUpSakila();
  await cleanupMeta();

  const { token, user } = await createUser({ app: server }, { roles: 'editor' });

  return { app: server, token, dbConfig: TestDbMngr.dbConfig, sakilaDbConfig: TestDbMngr.getSakilaDbConfig(), user } as NcUnitContext;
}
