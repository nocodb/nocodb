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
process.env[
  `NC_DB`
] = `pg://localhost:5432?u=postgres&p=password&d=meta_v2_2022_06_13`;

//process.env[`DEBUG`] = 'xc*';

(async () => {
  const httpServer = server.listen(process.env.PORT || 8080, async () => {
    server.use(await Noco.init({}, httpServer, server));
  });
})().catch((e) => console.log(e));
