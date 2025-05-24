import { serverConfig } from 'config'
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

async function bootstrap() {
  const httpServer = server.listen(serverConfig.port, async () => {
    server.use(await Noco.init({}, httpServer, server));
  });
}

bootstrap();
