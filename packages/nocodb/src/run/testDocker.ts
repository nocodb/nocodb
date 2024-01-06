import dns from 'node:dns';
import axios from 'axios';
import cors from 'cors';
import express from 'express';
import Noco from '~/Noco';
import { User } from '~/models';

process.env.NC_VERSION = '0009044';

// ref: https://github.com/nodejs/node/issues/40702#issuecomment-1103623246
dns.setDefaultResultOrder('ipv4first');

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

(async () => {
  if (process.env.NC_WORKER_CONTAINER === 'true') {
    const httpServer = server.listen(process.env.PORT || 8080, async () => {
      server.use(await Noco.init({}, httpServer, server));
    });
  } else {
    const httpServer = server.listen(process.env.PORT || 8080, async () => {
      server.use(await Noco.init({}, httpServer, server));

      let admin_response;
      if (!(await User.getByEmail('user@nocodb.com'))) {
        admin_response = await axios.post(
          `http://localhost:${
            process.env.PORT || 8080
          }/api/v1/auth/user/signup`,
          {
            email: 'user@nocodb.com',
            password: 'Password123.',
          },
        );
        console.log(admin_response.data);
      } else {
        admin_response = await axios.post(
          `http://localhost:${
            process.env.PORT || 8080
          }/api/v1/auth/user/signin`,
          {
            email: 'user@nocodb.com',
            password: 'Password123.',
          },
        );
      }

      for (let i = 0; i < 4; i++) {
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

          const user = await axios.get(
            `http://localhost:${process.env.PORT || 8080}/api/v1/auth/user/me`,
            {
              headers: {
                'xc-auth': response.data.token,
              },
            },
          );

          const response2 = await axios.patch(
            `http://localhost:${process.env.PORT || 8080}/api/v1/users/${
              user.data.id
            }`,
            { roles: 'org-level-creator' },
            {
              headers: {
                'xc-auth': admin_response.data.token,
              },
            },
          );

          console.log(response2.data);
        }
      }
    });
  }
})().catch((e) => console.log(e));
