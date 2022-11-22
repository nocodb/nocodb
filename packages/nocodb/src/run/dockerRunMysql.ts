import cors from 'cors';
import express from 'express';

import Noco from '../lib/Noco';

const server = express();
server.enable('trust proxy');
server.disable('etag');
server.disable('x-powered-by');
server.use(
  cors({
    exposedHeaders: 'xc-db-response',
  })
);

server.set('view engine', 'ejs');

const date = new Date();
const metaDb = `meta_v2_${date.getFullYear()}_${(date.getMonth() + 1)
  .toString()
  .padStart(2, '0')}_${date.getDate().toString().padStart(2, '0')}`;
process.env[`NC_DB`] = `mysql2://localhost:3306?u=root&p=password&d=${metaDb}`;
// process.env[`NC_DB`] = `pg:/2/localhost:3306?u=root&p=password&d=mar_24`;
// process.env[`NC_DB`] = `pg://localhost:5432?u=postgres&p=password&d=abcde`;
// process.env[`NC_TRY`] = 'true';
// process.env[`NC_DASHBOARD_URL`] = '/test';

// process.env[`DEBUG`] = 'xc*';

(async () => {
  const httpServer = server.listen(process.env.PORT || 8080, () => {
    console.log(`App started successfully.\nVisit -> ${Noco.dashboardUrl}`);
  });
  server.use(await Noco.init({}, httpServer, server));
})().catch((e) => console.log(e));
