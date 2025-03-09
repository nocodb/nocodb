process.env[`NC_DASHBOARD_URL`] = '/';

import cors from 'cors';
import express from 'express';
import Noco from '~/Noco';
import { handleUncaughtErrors } from '~/utils';
handleUncaughtErrors(process);

const server = express();
server.enable('trust proxy');
server.disable('etag');
server.disable('x-powered-by');
server.use(
  cors({
    exposedHeaders: 'xc-db-response',
  }),
);

server.set('view engine', 'ejs');

process.env[`DEBUG`] = 'xc*';

server.use(
  '/',
  express.static('/Users/pranavc/xgene/nocohub/packages/nc-gui/ee/dist'),
);

// (async () => {
//   await nocobuild(server);
//   const httpServer = server.listen(process.env.PORT || 8080, async () => {
//     console.log('Server started');
//   });
// })().catch((e) => console.log(e));

(async () => {
  const httpServer = server.listen(process.env.PORT || 8080, async () => {
    server.use(await Noco.init({}, httpServer, server));
  });
})().catch((e) => console.log(e));
