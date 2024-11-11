process.env[`NC_DASHBOARD_URL`] = '/';
process.env['NC_COGNITO_AWS_PROJECT_REGION'] = 'us-east-2';
process.env['NC_COGNITO_AWS_COGNITO_IDENTITY_POOL_ID'] =
  'us-east-2:f4cd8643-8c9b-4fda-b949-eedcc39a0c5d';
process.env['NC_COGNITO_AWS_COGNITO_REGION'] = 'us-east-2';
process.env['NC_COGNITO_AWS_USER_POOLS_ID'] = 'us-east-2_MNegyNf5T';
process.env['NC_COGNITO_AWS_USER_POOLS_WEB_CLIENT_ID'] =
  '5lo3lv5kj4t4nukutsvmbbq5s7';
process.env['NC_COGNITO_OAUTH_DOMAIN'] =
  'ncguiaf56d838-af56d838-dev.auth.us-east-2.amazoncognito.com';
process.env['NC_COGNITO_OAUTH_REDIRECTSIGNIN'] = 'http://localhost:3000';
process.env['NC_COGNITO_OAUTH_REDIRECTSIGNOUT'] = 'http://localhost:3000';


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
  const httpServer = server.listen(process.env.PORT || 8080, async () => {
    server.use(await Noco.init({}, httpServer, server));
  });
})().catch((e) => console.log(e));
