import dns from 'node:dns';
import express from 'express';
import cors from 'cors';
import Noco from '~/Noco';

// ref: https://github.com/nodejs/node/issues/40702#issuecomment-1103623246
dns.setDefaultResultOrder('ipv4first');

const server = express();
server.enable('trust proxy');
server.use(cors());

server.set('view engine', 'ejs');

(async () => {
  const httpServer = server.listen(process.env.PORT || 8080, async () => {
    server.use(await Noco.init({}, httpServer, server));
  });
})().catch((e) => console.log(e));
