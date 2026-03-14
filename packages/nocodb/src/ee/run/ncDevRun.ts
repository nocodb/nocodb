/**
 * nc-dev entrypoint — used by `make nc-dev-develop` and `make nc-dev`
 *
 * Uses fixed DB names meta_develop / data_develop so all branches can fork
 * from a stable snapshot rather than date-based ephemeral DBs.
 *
 * Also enables sql-executor + local hooks (same as testDocker.ts).
 */
import cors from 'cors';
import express from 'express';
import Noco from '~/Noco';
import { handleUncaughtErrors } from '~/utils';
handleUncaughtErrors(process);

const server = express();
server.enable('trust proxy');
server.disable('etag');
server.disable('x-powered-by');
server.use(cors({ exposedHeaders: 'xc-db-response' }));
server.set('view engine', 'ejs');

// Fixed DB names — nc-dev develop seeds these; branches fork from them
process.env['NC_DB'] ??=
  'pg://localhost:5432?u=postgres&p=password&d=meta_develop';
process.env['NC_DATA_DB'] ??=
  'pg://localhost:5432?u=postgres&p=password&d=data_develop';

// Enable sql-executor and local hooks (same flags as testDocker.ts)
process.env['NC_ALLOW_LOCAL_EXTERNAL_DBS'] = 'true';
process.env['NC_ALLOW_LOCAL_HOOKS'] = 'true';

(async () => {
  const httpServer = server.listen(process.env.PORT || 8080, async () => {
    server.use(await Noco.init({}, httpServer, server));
  });
})().catch((e) => console.log(e));
