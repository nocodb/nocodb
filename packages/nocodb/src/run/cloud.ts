import { serverConfig } from 'config'
import path from 'path';
import cors from 'cors';
import express from 'express';

import Noco from '~/Noco';
import { serverConfig } from 'config';

const server = express();
server.enable('trust proxy');
server.use(cors());
server.use(
  serverConfig.dashboardUrl,
  express.static(path.join(__dirname, 'nc-gui')),
);

// if NC_DASHBOARD_URL is not set to /dashboard, then redirect '/dashboard'
// to the path set in NC_DASHBOARD_URL
if (!/^\/?dashboard\/?$/.test(serverConfig.dashboardUrl)) {
  server.use('/dashboard', (req, res) => {
    // Extract the original query parameters
    const originalQueryParams = new URLSearchParams(req.query as any);

    // Build the redirect URL without including the host
    const redirectUrl = `${serverConfig.dashboardUrl}${
      originalQueryParams.toString() ? '?' + originalQueryParams.toString() : ''
    }`;

    // Perform the redirect
    res.redirect(redirectUrl);
  });
}

server.set('view engine', 'ejs');

(async () => {
  const httpServer = server.listen(serverConfig.port, async () => {
    console.log(`App started successfully.\nVisit -> ${Noco.dashboardUrl}`);
    server.use(await Noco.init({}, httpServer, server));
  });
})().catch((e) => console.log(e));
