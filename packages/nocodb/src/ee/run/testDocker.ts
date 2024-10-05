import axios from 'axios';
import cors from 'cors';
import express from 'express';
import Noco from '~/Noco';
import NocoCache from '~/cache/NocoCache';
import { User } from '~/models';

const IS_UPGRADE_ALLOWED_CACHE_KEY = 'nc_upgrade_allowed';

process.env.NC_VERSION = '0009044';

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
process.env[`NC_ALLOW_LOCAL_HOOKS`] = 'true';
process.env[`NC_ALLOW_LOCAL_EXTERNAL_DBS`] = 'true';
process.env[`NC_DISABLE_BASE_AS_PG_SCHEMA`] = 'false';

// this is required for SSO tests used in: packages/nocodb/src/ee/controllers/auth/sso-auth.controller.ts
process.env[`NC_DASHBOARD_URL`] = 'http://localhost:3000';

process.env[`TEST`] = 'true';

(async () => {
  if (process.env.NC_WORKER_CONTAINER === 'true') {
    const httpServer = server.listen(process.env.PORT || 8080, async () => {
      server.use(await Noco.init({}, httpServer, server));
    });
  } else {
    const httpServer = server.listen(process.env.PORT || 8080, async () => {
      server.use(await Noco.init({}, httpServer, server));

      await NocoCache.set(IS_UPGRADE_ALLOWED_CACHE_KEY, 'user@nocodb.com');

      if (!(await User.getByEmail('user@nocodb.com'))) {
        const response = await axios.post(
          `http://localhost:${
            process.env.PORT || 8080
          }/api/v1/auth/user/signup`,
          {
            email: 'user@nocodb.com',
            password: 'Password123.',
          },
        );
        console.log(response.data);
      }

      for (let i = 0; i < 8; i++) {
        if (!(await User.getByEmail(`user-${i}@nocodb.com`))) {
          const response = await axios.post(
            `http://localhost:${
              process.env.PORT || 8080
            }/api/v1/auth/user/signup`,
            {
              email: `user-${i}@nocodb.com`,
              password: 'Password123.',
            },
          );
          console.log(response.data);
        }
      }
    });
  }
})().catch((e) => console.log(e));
