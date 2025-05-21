import { serverConfig } from 'config'
import path from 'path';
import cors from 'cors';
import express from 'express';

import Noco from '~/Noco';
import { handleUncaughtErrors } from '~/utils';
import { serverConfig } from 'config';
handleUncaughtErrors(process);

const server = express();
server.enable('trust proxy');
server.use(cors());
server.use(
  serverConfig.dashboardUrl,
  express.static(path.join(__dirname, 'nc-gui')),
);
server.set('view engine', 'ejs');

(async () => {
  const httpServer = server.listen(serverConfig.port, async () => {
    console.log(`App started successfully.\nVisit -> ${Noco.dashboardUrl}`);
    server.use(await Noco.init({}, httpServer, server));
  });
})().catch((e) => console.log(e));
