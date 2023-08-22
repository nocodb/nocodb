import express from 'express';
import cors from 'cors';
import Noco from '../Noco';

const server = express();
server.enable('trust proxy');
server.use(cors());

server.set('view engine', 'ejs');

(async () => {
  const httpServer = server.listen(process.env.PORT || 8080, async () => {
    server.use(await Noco.init({}, httpServer, server));
  });
})().catch((e) => console.log(e));
