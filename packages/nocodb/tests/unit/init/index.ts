import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import nocobuild from '~/nocobuild';
// import { Noco } from '~/lib';
import { createUser } from '~test/factory/user';
import cleanupMeta from './cleanupMeta';
import { cleanUpSakila, resetAndSeedSakila } from './cleanupSakila';
import type { Base } from '~/models';
import type { INestApplication } from '@nestjs/common';
import Noco from '~/Noco';

// superagent 10.x leaves listeners attached to the IncomingMessage, ClientRequest
// and underlying Socket after a successful request — `error` is the most obvious
// (`.once('error', …)` never fires on success) but `close`/`data`/`end`/`readable`
// on the response, `finish`/`drain` on the request, and the full socket event set
// also remain bound to closures that capture the response body. By the time
// Test.end's callback fires the response is fully drained and supertest has no
// more work to do with these emitters, so strip them wholesale.
(() => {
  const SupertestTest: any = (request as any).Test;
  if (!SupertestTest?.prototype?.end || SupertestTest.prototype.__leakPatched) {
    return;
  }
  const originalEnd = SupertestTest.prototype.end;
  SupertestTest.prototype.end = function (fn?: (err: any, res: any) => void) {
    return originalEnd.call(this, (err: any, res: any) => {
      const incoming = res?.res ?? res;
      if (incoming) {
        incoming.removeAllListeners?.();
        incoming.req?.removeAllListeners?.();
        incoming.socket?.removeAllListeners?.();
      }
      fn?.(err, res);
    });
  };
  SupertestTest.prototype.__leakPatched = true;
})();

let server;
let nestApp: INestApplication<any>;

const serverInit = async () => {
  const serverInstance = express();
  serverInstance.enable('trust proxy');
  // cookie-parser mirrors production setup (Noco.init() registers it on the
  // nestApp). nocobuild() doesn't, so add it on the outer express instance
  // here — required for tests that exercise cookie-based flows (refresh token).
  serverInstance.use(cookieParser());
  // serverInstance.use(await Noco.init());
  const { nestApp } = await nocobuild(serverInstance);
  serverInstance.use(function (req, res, next) {
    // 50 sec timeout
    req.setTimeout(500000, function () {
      console.log('Request has timed out.');
      res.send(408);
    });
    next();
  });
  // Pre-bind to a single http.Server so supertest reuses it instead of
  // calling app.listen(0) on every `request(app)` call — heap snapshots
  // showed ~27k orphaned Server instances per set-3 run from that pattern.
  const listening = serverInstance.listen(0);
  return { serverInstance: listening, nestApp };
};

const isFirstTimeRun = () => !server;

export default async function init(
  forceReset = false,
  roles = 'editor',
  options?: { skipSakila?: boolean },
) {
  const { skipSakila = false } = options ?? {};
  const { default: TestDbMngr } = await import('../TestDbMngr');

  if (isFirstTimeRun()) {
    await resetAndSeedSakila();
    await TestDbMngr.setupDataDb();
    const serverInitResult = await serverInit();
    server = serverInitResult.serverInstance;
    nestApp = serverInitResult.nestApp;
    Noco._nestApp = nestApp;
  }

  if (!skipSakila) {
    await cleanUpSakila(forceReset);
  }
  await cleanupMeta();
  await TestDbMngr.cleanupDataDb();

  const { token, user } = await createUser({ app: server }, { roles });

  const extra: {
    fk_workspace_id?: string;
  } = {};

  // create ws for ee
  if (process.env.EE === 'true') {
    const ws = await request(server)
      .post('/api/v1/workspaces/')
      .set('xc-auth', token)
      .send({
        title: 'Workspace',
        meta: {
          color: '#146C8E',
        },
      });

    extra.fk_workspace_id = ws.body.id;
  } else {
    const appInfo = await request(server)
      .get('/api/v1/meta/nocodb/info')
      .set('xc-auth', token)
      .expect(200);
    extra.fk_workspace_id = appInfo.body.defaultWorkspaceId;
  }

  const xc_token = (
    await request(server)
      .post('/api/v1/tokens/')
      .set('xc-auth', token)
      .expect(200)
  ).body.token;

  // `dbConfig` describes the meta DB. `dataDbConfig` describes the user-data
  // DB — equal to `dbConfig` in the standard setup, distinct when
  // `NC_TEST_DATA_CLIENT=mssql` (pg meta + mssql data). Tests that gate on
  // dialect should use `isMssqlData(context)` / `isPgData(context)` from
  // `init/db.ts` to read this — `isPg(context)` etc. inspect the META client
  // only and silently mis-route on mixed-dialect runs.
  const dataDbConfig = TestDbMngr.isMssqlDataDb()
    ? TestDbMngr.getMssqlDataDbConfig()
    : TestDbMngr.dbConfig;

  return {
    app: server,
    nestApp,
    token,
    xc_token,
    user,
    dbConfig: TestDbMngr.dbConfig,
    dataDbConfig,
    sakilaDbConfig: TestDbMngr.getSakilaDbConfig(),
    ...extra,
  };
}

export type IInitContext = Awaited<ReturnType<typeof init>>;

export interface ITestContext {
  context: IInitContext;
  ctx: {
    workspace_id: any;
    base_id: any;
  };
  base: Base;
}
