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

// Use env vars if set, otherwise generate date-based names
if (!process.env.NC_DB) {
  const date = new Date();
  const dbSuffix = `${date.getFullYear()}_${(date.getMonth() + 1)
    .toString()
    .padStart(2, '0')}_${(date.getDate() - 1).toString().padStart(2, '0')}`;

  process.env.NC_DB = `pg://localhost:5432?u=postgres&p=password&d=meta_${dbSuffix}`;
  process.env.NC_DATA_DB = `pg://localhost:5432?u=postgres&p=password&d=data_${dbSuffix}`;
}

(async () => {
  const httpServer = server.listen(process.env.PORT || 8080, async () => {
    server.use(await Noco.init({}, httpServer, server));
  });
})().catch((e) => console.log(e));
