// todo: move to env
// defining at the top to override the default value in app.config.ts
process.env.NC_DASHBOARD_URL = process.env.NC_DASHBOARD_URL ?? '/';

import path from 'path';
import cors from 'cors';
import express from 'express';

import Noco from '~/Noco';

const server = express();
server.enable('trust proxy');
server.use(cors());
server.use(
  process.env.NC_DASHBOARD_URL ?? '/dashboard',
  express.static(path.join(__dirname, 'nc-gui')),
);

// if NC_DASHBOARD_URL is not set to /dashboard, then redirect '/dashboard'
// to the path set in NC_DASHBOARD_URL
if (!/^\/?dashboard\/?$/.test(process.env.NC_DASHBOARD_URL)) {
  server.use('/dashboard', (_, res) => {
    // redirect to NC_DASHBOARD_URL path
    res.redirect(process.env.NC_DASHBOARD_URL);
  });
}

server.set('view engine', 'ejs');

(async () => {
  const httpServer = server.listen(process.env.PORT || 8080, async () => {
    console.log(`App started successfully.\nVisit -> ${Noco.dashboardUrl}`);
    server.use(await Noco.init({}, httpServer, server));
  });
})().catch((e) => console.log(e));
