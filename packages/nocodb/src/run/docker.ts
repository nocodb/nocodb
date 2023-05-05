import axios from 'axios';
import cors from 'cors';
import express from 'express';
import Noco from '../Noco';

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

process.env[`DEBUG`] = 'xc*';

// (async () => {
//   await nocobuild(server);
//   const httpServer = server.listen(process.env.PORT || 8080, async () => {
//     console.log('Server started');
//   });
// })().catch((e) => console.log(e));

(async () => {
  const httpServer = server.listen(process.env.PORT || 8080, async () => {
    server.use(await Noco.init({}, httpServer, server));
  });
})().catch((e) => console.log(e));
