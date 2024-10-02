import cors from 'cors';
import express from 'express';
import Noco from '~/Noco';

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

const date = new Date();
const dbSuffix = `${date.getFullYear()}_${(date.getMonth() + 1)
  .toString()
  .padStart(2, '0')}_${date.getDate().toString().padStart(2, '0')}`;
process.env[
  `NC_CONNECTION_ENCRYPT_KEY`
] = '4dc7b814-4759-4493-b320-955cd4b3ff62'
process.env[
  `NC_DB`
] = `pg://localhost:5432?u=postgres&p=password&d=db_bk`;
process.env[
  `NC_DATA_DB`
] = `pg://localhost:5432?u=postgres&p=password&d=data_${dbSuffix}1`;
process.env[`NC_DISABLE_BASE_AS_PG_SCHEMA`] = `false`;
// process.env[`NC_DATA_DB`] = `pg://localhost:5432?u=postgres&p=password&d=${metaDb}_data`;
// process.env[`NC_TRY`] = 'true';
// process.env[`NC_DASHBOARD_URL`] = '/test';

// process.env[`DEBUG`] = 'xc*';

(async () => {
  const httpServer = server.listen(process.env.PORT || 8080, async () => {
    server.use(await Noco.init({}, httpServer, server));
  });
})().catch((e) => console.log(e));
