import { Page, selectors } from '@playwright/test';
import axios from 'axios';
import { Api, ProjectType, ProjectTypes, UserType, WorkspaceType } from 'nocodb-sdk';
import { getDefaultPwd } from '../tests/utils/general';
import { knex } from 'knex';
import { promises as fs } from 'fs';

// Use local reset logic instead of remote
const enableLocalInit = true;

// PG Configuration
//
const config = {
  client: 'pg',
  connection: {
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'password',
    database: 'postgres',
    multipleStatements: true,
  },
  searchPath: ['public', 'information_schema'],
  pool: { min: 0, max: 5 },
};

// Sakila Knex Configuration
//
const sakilaKnexConfig = (parallelId: string) => ({
  ...config,
  connection: {
    ...config.connection,
    database: `sakila${parallelId}`,
  },
});

// External PG Project create payload
//
const extPgProject = (workspaceId, title, parallelId, projectType) => ({
  fk_workspace_id: workspaceId,
  title,
  type: projectType,
  bases: [
    {
      type: 'pg',
      config: {
        client: 'pg',
        connection: {
          host: 'localhost',
          port: '5432',
          user: 'postgres',
          password: 'password',
          database: `sakila${parallelId}`,
        },
        searchPath: ['public'],
      },
      inflection_column: 'camelize',
      inflection_table: 'camelize',
    },
  ],
  external: true,
});

const workerCount = [0, 0, 0, 0, 0, 0, 0, 0];

export interface NcContext {
  project: ProjectType;
  token: string;
  dbType?: string;
  workerId?: string;
  rootUser: UserType & { password: string };
  workspace: WorkspaceType;
}

selectors.setTestIdAttribute('data-testid');
const workerStatus = {};

async function localInit({
  workerId,
  isEmptyProject = false,
  projectType = ProjectTypes.DATABASE,
  isSuperUser = false,
}: {
  workerId: string;
  isEmptyProject?: boolean;
  projectType?: ProjectTypes;
  isSuperUser?: boolean;
}) {
  const parallelId = process.env.TEST_PARALLEL_INDEX;
  // wait till previous worker is done
  while (workerStatus[parallelId] === 'processing') {
    console.log(`waiting for previous worker to finish parrelelId:${parallelId}`);
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  workerStatus[parallelId] = 'processing';

  try {
    let response;
    // Login as root user
    if (isSuperUser) {
      // required for configuring license key settings
      response = await axios.post('http://localhost:8080/api/v1/auth/user/signin', {
        email: `user@nocodb.com`,
        password: getDefaultPwd(),
      });
    } else {
      response = await axios.post('http://localhost:8080/api/v1/auth/user/signin', {
        email: `user-${parallelId}@nocodb.com`,
        password: getDefaultPwd(),
      });
    }
    const token = response.data.token;

    // Init SDK using token
    const api = new Api({
      baseURL: `http://localhost:8080/`,
      headers: {
        'xc-auth': token,
      },
    });

    // const workspaceTitle_old = `ws_pgExtREST${+workerId - 1}`;
    const workspaceTitle = `ws_pgExtREST${workerId}`;
    const projectTitle = `pgExtREST${workerId}`;

    // console.log(process.env.TEST_WORKER_INDEX, process.env.TEST_PARALLEL_INDEX);

    // Delete associated workspace
    // Note that: on worker error, entire thread is reset & worker ID numbering is reset too
    // Hence, workspace delete is based on workerId prefix instead of just workerId
    const ws = await api.workspace.list();
    for (const w of ws.list) {
      // check if w.title starts with workspaceTitle
      if (w.title.startsWith(`ws_pgExtREST_p${process.env.TEST_PARALLEL_INDEX}`)) {
        try {
          await api.workspace.delete(w.id);
        } catch (e) {
          console.log(`Error deleting workspace: ${w.id}`, `user-${parallelId}@nocodb.com`, isSuperUser);
        }
      }
    }

    // DB reset
    if (!isEmptyProject) {
      let pgknex;
      try {
        pgknex = knex(config);
        await pgknex.raw(`DROP DATABASE IF EXISTS sakila${workerId} WITH (FORCE)`);
        await pgknex.raw(`CREATE DATABASE sakila${workerId}`);
      } catch (e) {
        console.error(`Error resetting pg sakila db: Worker ${workerId}`);
      } finally {
        if (pgknex) await pgknex.destroy();
      }

      await resetSakilaPg(workerId);
    }

    // create a new workspace
    const workspace = await api.workspace.create({
      title: workspaceTitle,
    });

    let project;
    if (isEmptyProject) {
      // create a new project under the workspace we just created
      project = await api.project.create({
        title: projectTitle,
        // @ts-expect-error
        fk_workspace_id: workspace.id,
        type: projectType,
      });
    } else {
      if ('id' in workspace) {
        // @ts-ignore
        project = await api.project.create(extPgProject(workspace.id, projectTitle, workerId, projectType));
      }
    }
    workerStatus[parallelId] = 'complete';

    // get current user information
    const user = await api.auth.me();
    return { data: { project, user, workspace, token }, status: 200 };
  } catch (e) {
    workerStatus[parallelId] = 'errored';

    console.error(`Error resetting project: ${process.env.TEST_PARALLEL_INDEX}`, e);
    return { data: {}, status: 500 };
  }
}

const setup = async ({
  projectType = ProjectTypes.DATABASE,
  page,
  isEmptyProject = false,
  isSuperUser = false,
  url,
}: {
  projectType?: ProjectTypes;
  page: Page;
  isEmptyProject?: boolean;
  isSuperUser?: boolean;
  url?: string;
}): Promise<NcContext> => {
  // on noco-hub, only PG is supported
  const dbType = 'pg';
  let response;

  const workerIndex = process.env.TEST_WORKER_INDEX;
  const parallelIndex = process.env.TEST_PARALLEL_INDEX;

  const workerId = `_p${parallelIndex}_w${workerIndex}_c${(+workerIndex + 1) * 1000 + workerCount[parallelIndex]}`;
  // console.log(workerId);

  // const workerId =
  //   String(process.env.TEST_WORKER_INDEX) + String(process.env.TEST_PARALLEL_INDEX) + String(workerCount[workerIndex]);
  // const workerId = parallelIndex + String(+parallelIndex * workerCount[+parallelIndex]);
  workerCount[+parallelIndex]++;

  // console.log(process.env.TEST_PARALLEL_INDEX, '#Setup', workerId);

  try {
    // Localised reset logic
    if (enableLocalInit) {
      response = await localInit({
        workerId,
        isEmptyProject,
        projectType,
        isSuperUser,
      });
    }
    // Remote reset logic
    else {
      response = await axios.post(`http://localhost:8080/api/v1/meta/test/reset`, {
        parallelId: process.env.TEST_PARALLEL_INDEX,
        workerId: workerId,
        dbType,
        projectType,
        isEmptyProject,
      });
    }
  } catch (e) {
    console.error(`Error resetting project: ${process.env.TEST_PARALLEL_INDEX}`, e);
  }

  if (response.status !== 200 || !response.data?.token || !response.data?.project) {
    console.error('Failed to reset test data', response.data, response.status);
    throw new Error('Failed to reset test data');
  }
  const token = response.data.token;

  try {
    const admin = await axios.post('http://localhost:8080/api/v1/auth/user/signin', {
      email: `user@nocodb.com`,
      password: getDefaultPwd(),
    });
    await axios.post(`http://localhost:8080/api/v1/license`, { key: '' }, { headers: { 'xc-auth': admin.data.token } });
  } catch (e) {
    // ignore error: some roles will not have permission for license reset
    // console.error(`Error resetting project: ${process.env.TEST_PARALLEL_INDEX}`, e);
  }

  await page.addInitScript(
    async ({ token }) => {
      try {
        let initialLocalStorage = {};
        try {
          initialLocalStorage = JSON.parse(localStorage.getItem('nocodb-gui-v2') || '{}');
        } catch (e) {
          console.error('Failed to parse local storage', e);
        }
        window.localStorage.setItem(
          'nocodb-gui-v2',
          JSON.stringify({
            ...initialLocalStorage,
            token: token,
          })
        );
      } catch (e) {
        window.console.log('initialLocalStorage error');
      }
    },
    { token: token }
  );

  const project = response.data.project;
  const rootUser = { ...response.data.user, password: getDefaultPwd() };
  const workspace = response.data.workspace;

  // default landing page for tests
  let projectUrl;
  switch (project.type) {
    case ProjectTypes.DOCUMENTATION:
      projectUrl = url ? url : `/#/ws/${project.fk_workspace_id}/nc/${project.id}/doc`;
      break;
    case ProjectTypes.DATABASE:
      projectUrl = url ? url : `/#/ws/${project.fk_workspace_id}/nc/${project.id}`;
      break;
    default:
      throw new Error(`Unknown project type: ${project.type}`);
  }

  await page.goto(projectUrl, { waitUntil: 'networkidle' });
  return { project, token, dbType, workerId, rootUser, workspace } as NcContext;
};

// Reference
// packages/nocodb/src/lib/services/test/TestResetService/resetPgSakilaProject.ts
//
const resetSakilaPg = async (parallelId: string) => {
  const testsDir = __dirname.replace('/tests/playwright/setup', '/packages/nocodb/tests');

  let sakilaKnex;
  try {
    sakilaKnex = knex(sakilaKnexConfig(parallelId));
    const schemaFile = await fs.readFile(`${testsDir}/pg-sakila-db/01-postgres-sakila-schema.sql`);
    await sakilaKnex.raw(schemaFile.toString());

    const trx = await sakilaKnex.transaction();
    const dataFile = await fs.readFile(`${testsDir}/pg-sakila-db/02-postgres-sakila-insert-data.sql`);
    await trx.raw(dataFile.toString());
    await trx.commit();
  } catch (e) {
    console.error(`Error resetting pg sakila db: Worker ${parallelId}`);
    throw Error(`Error resetting pg sakila db: Worker ${parallelId}`);
  } finally {
    if (sakilaKnex) await sakilaKnex.destroy();
  }
};

// General purpose API based routines
//

export default setup;
