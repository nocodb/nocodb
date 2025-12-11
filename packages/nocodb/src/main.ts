import cors from 'cors';
import express from 'express';
import Noco from '~/Noco';
import { getCorsOptions } from '~/utils/nc-config/cors';

const server = express();
server.enable('trust proxy');
server.disable('etag');
server.disable('x-powered-by');
server.use(cors(getCorsOptions()));

server.set('view engine', 'ejs');

async function bootstrap() {
  const httpServer = server.listen(process.env.PORT || 8080, async () => {
    server.use(await Noco.init({}, httpServer, server));
  });
}

bootstrap();
