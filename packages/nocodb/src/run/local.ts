import dns from 'node:dns';
import path from 'path';
import cors from 'cors';
import express from 'express';
import Noco from '~/Noco';

// ref: https://github.com/nodejs/node/issues/40702#issuecomment-1103623246
dns.setDefaultResultOrder('ipv4first');

const server = express();
server.enable('trust proxy');
server.use(cors());
server.use(
  process.env.NC_DASHBOARD_URL ?? '/dashboard',
  express.static(path.join(__dirname, 'nc-gui')),
);
server.set('view engine', 'ejs');

(async () => {
  const httpServer = server.listen(process.env.PORT || 8080, async () => {
    console.log(`App started successfully.\nVisit -> ${Noco.dashboardUrl}`);
    server.use(await Noco.init({}, httpServer, server));
  });
})().catch((e) => console.log(e));
