import dns from 'node:dns';
import axios from 'axios';
import cors from 'cors';
import express from 'express';
import { WorkspaceUserRoles } from 'nocodb-sdk';
import Noco from '~/Noco';
import { User, WorkspaceUser } from '~/models';
import { handleUncaughtErrors } from '~/utils';
handleUncaughtErrors(process);

process.env.NC_VERSION = '0009044';

// ref: https://github.com/nodejs/node/issues/40702#issuecomment-1103623246
dns.setDefaultResultOrder('ipv4first');

const server = express();
server.enable('trust proxy');
server.disable('etag');
server.disable('x-powered-by');
server.use(
  cors({
    exposedHeaders:
      'xc-db-response, X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, X-RateLimit-Policy, Retry-After',
  }),
);

server.set('view engine', 'ejs');

process.env[`DEBUG`] = 'xc*';
process.env[`NC_ALLOW_LOCAL_HOOKS`] = 'true';
process.env[`NC_ALLOW_LOCAL_EXTERNAL_DBS`] = 'true';
process.env[`NC_ALLOW_LOCAL_DATA_IMPORT`] = 'true';

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

          // baseCreate (and every other workspace-scoped op) is resolved
          // against the user's DEFAULT-WORKSPACE role, not their org role. The
          // org-role PATCH above used to cascade to the default-workspace role,
          // but that side effect was intentionally removed as a security fix
          // (cf0264c2122 / defect 9). Set the workspace role explicitly here so
          // the seeded test user can create bases — otherwise it stays
          // WorkspaceUserRoles.NO_ACCESS and Playwright setup fails every base
          // create with "403 baseCreate … roles: No Access".
          if (Noco.ncDefaultWorkspaceId) {
            await WorkspaceUser.update(
              Noco.ncDefaultWorkspaceId,
              user.data.id,
              { roles: WorkspaceUserRoles.CREATOR },
            );
          }
        }
      }
    });
  }
})().catch((e) => console.log(e));
