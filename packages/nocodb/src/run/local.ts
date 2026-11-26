import dns from 'node:dns';
import path from 'path';
import cors from 'cors';
import express from 'express';
import Noco from '~/Noco';
import { handleUncaughtErrors } from '~/utils';
import { ncStaticCompression, ncStaticOptions } from '~/helpers/staticAssets';
import { getBasePath, stripBasePathMiddleware } from '~/helpers/basePath';
handleUncaughtErrors(process);

// ref: https://github.com/nodejs/node/issues/40702#issuecomment-1103623246
dns.setDefaultResultOrder('ipv4first');

const server = express();
server.use(stripBasePathMiddleware());
server.use(cors());
const ncGuiPath = path.join(__dirname, 'nc-gui');
process.env.NC_GUI_DIST_PATH = process.env.NC_GUI_DIST_PATH ?? ncGuiPath;
// Under a subpath the shell must be rewritten, so GuiMiddleware serves it.
const servesRawShell = getBasePath() === '/';
const ncGuiStatic = express.static(ncGuiPath, {
  ...ncStaticOptions,
  index: servesRawShell ? 'index.html' : false,
  // Its `/x` → `/x/` redirect is root-relative and would leave the subpath
  redirect: servesRawShell,
});
server.use('/', ncStaticCompression(), (req, res, next) => {
  if (!servesRawShell && req.path.endsWith('.html')) return next();
  return ncGuiStatic(req, res, next);
});
server.set('view engine', 'ejs');

(async () => {
  const httpServer = server.listen(process.env.PORT || 8080, async () => {
    console.log(`App started successfully.\nVisit -> ${Noco.dashboardUrl}`);
    server.use(await Noco.init({}, httpServer, server));
  });
})().catch((e) => console.log(e));
