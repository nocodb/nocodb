process.env.NC_COGNITO_AWS_PROJECT_REGION = 'us-east-2';
process.env.NC_COGNITO_AWS_COGNITO_IDENTITY_POOL_ID =
  'us-east-2:16bb8711-47cf-479b-9b35-aa506f91c436';
process.env.NC_COGNITO_AWS_COGNITO_REGION = 'us-east-2';
process.env.NC_COGNITO_AWS_USER_POOLS_ID = 'us-east-2_STrmC0yso';
process.env.NC_COGNITO_AWS_USER_POOLS_WEB_CLIENT_ID =
  '3139p206qmeeh977b6k79njkla';
process.env.NC_COGNITO_OAUTH_DOMAIN = 'auth.nocodb.com';

process.env.NC_COGNITO_OAUTH_REDIRECTSIGNIN = 'http://localhost:3000';
process.env.NC_COGNITO_OAUTH_REDIRECTSIGNOUT = 'http://localhost:3000';

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

process.env[`DEBUG`] = 'xc*';

// (async () => {
//   await nocobuild(server);
//   const httpServer = server.listen(process.env.PORT || 8080, async () => {
//     console.log('Server started');
//   });
// })().catch((e) => console.log(e));

(async () => {
  if (process.env.NC_WORKER_CONTAINER === 'true') {
    await Noco.init({}, null, null);
  } else {
    const httpServer = server.listen(process.env.PORT || 8080, async () => {
      server.use(await Noco.init({}, httpServer, server));
    });
  }
})().catch((e) => console.log(e));
