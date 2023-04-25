import { Page, selectors } from '@playwright/test';
import axios from 'axios';
import { Api, ProjectType, ProjectTypes, UserType, WorkspaceType } from 'nocodb-sdk';
import { getDefaultPwd } from '../tests/utils/general';
import { knex } from 'knex';
import { promises as fs } from 'fs';
let api: Api<any>;

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
    database: `sakila_${parallelId}`,
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
          database: `sakila_${parallelId}`,
        },
        searchPath: ['public'],
      },
      inflection_column: 'camelize',
      inflection_table: 'camelize',
    },
  ],
  external: true,
});

const workerCount = {};

export interface NcContext {
  project: ProjectType;
  token: string;
  dbType?: string;
  workerId?: string;
  rootUser: UserType & { password: string };
  workspace: WorkspaceType;
}

selectors.setTestIdAttribute('data-testid');

async function localInit({
  parallelId = process.env.TEST_PARALLEL_INDEX,
  isEmptyProject = false,
  projectType = ProjectTypes.DATABASE,
}: {
  parallelId: string;
  isEmptyProject?: boolean;
  projectType?: ProjectTypes;
}) {
  // Login as root user
  const response = await axios.post('http://localhost:8080/api/v1/auth/user/signin', {
    email: 'user@nocodb.com',
    password: getDefaultPwd(),
  });
  const token = response.data.token;

  // Init SDK using token
  api = new Api({
    baseURL: `http://localhost:8080/`,
    headers: {
      'xc-auth': token,
    },
  });

  const workspaceTitle = `ws_pgExtREST${parallelId}`;
  const projectTitle = `pgExtREST${parallelId}`;

  // Delete all workspaces
  const ws = await api.workspace.list();
  for (const w of ws.list) {
    await api.workspace.delete(w.id);
  }

  // DB reset
  const pgknex = knex(config);
  await pgknex.raw(`DROP DATABASE IF EXISTS sakila_${parallelId} WITH (FORCE)`);
  await pgknex.raw(`CREATE DATABASE sakila_${parallelId}`);
  await pgknex.destroy();

  if (!isEmptyProject) {
    await resetSakilaPg(parallelId);
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
      project = await api.project.create(extPgProject(workspace.id, projectTitle, parallelId, projectType));
    }
  }

  // get current user information
  const user = await api.auth.me();

  return { data: { project, user, workspace, token }, status: 200 };
}

const setup = async ({
  projectType = ProjectTypes.DATABASE,
  page,
  isEmptyProject = false,
  url,
}: {
  projectType?: ProjectTypes;
  page: Page;
  isEmptyProject?: boolean;
  url?: string;
}): Promise<NcContext> => {
  // on noco-hub, only PG is supported
  const dbType = 'pg';
  let response, workerId;

  // local parallel execution not supported with local init
  if (enableLocalInit) {
    workerId = '0';
  } else {
    const workerIndex = process.env.TEST_PARALLEL_INDEX;
    if (!workerCount[workerIndex]) {
      workerCount[workerIndex] = 0;
    }
    workerCount[workerIndex]++;
    workerId = String(Number(workerIndex) + Number(workerCount[workerIndex]) * 4);
  }

  try {
    // Localised reset logic
    if (enableLocalInit) {
      response = await localInit({ parallelId: process.env.TEST_PARALLEL_INDEX, isEmptyProject, projectType });
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

  // Browser local storage configurations
  //
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
        window.console.log(e);
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

  try {
    const sakilaKnex = knex(sakilaKnexConfig(parallelId));
    const schemaFile = await fs.readFile(`${testsDir}/pg-sakila-db/01-postgres-sakila-schema.sql`);
    await sakilaKnex.raw(schemaFile.toString());

    const trx = await sakilaKnex.transaction();
    const dataFile = await fs.readFile(`${testsDir}/pg-sakila-db/02-postgres-sakila-insert-data.sql`);
    await trx.raw(dataFile.toString());
    await trx.commit();

    await sakilaKnex.destroy();
  } catch (e) {
    console.error(`Error resetting pg sakila db: Worker ${parallelId}`);
    throw Error(`Error resetting pg sakila db: Worker ${parallelId}`);
  }
};

// General purpose API based routines
//
async function getWorkspaceId(title: string) {
  const ws = await api.workspace.list();
  for (const w of ws.list) {
    if (w.title === title) {
      return w.id;
    }
  }
  return null;
}

export default setup;
export { getWorkspaceId };
