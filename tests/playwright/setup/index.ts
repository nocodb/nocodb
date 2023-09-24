import { Page, selectors } from '@playwright/test';
import axios, { AxiosResponse } from 'axios';
import { Api, ProjectListType, ProjectType, ProjectTypes, UserType, WorkspaceType } from 'nocodb-sdk';
import { getDefaultPwd } from '../tests/utils/general';
import { Knex, knex } from 'knex';
import { promises as fs } from 'fs';
import { isEE } from './db';
import { resetSakilaPg } from './knexHelper';
import path from 'path';

// MySQL Configuration
const mysqlConfig = {
  client: 'mysql2',
  connection: {
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: 'password',
    database: 'sakila',
    multipleStatements: true,
    dateStrings: true,
  },
};

const extMysqlProject = (title, parallelId) => ({
  title,
  bases: [
    {
      type: 'mysql2',
      config: {
        client: 'mysql2',
        connection: {
          host: 'localhost',
          port: '3306',
          user: 'root',
          password: 'password',
          database: `test_sakila_${parallelId}`,
        },
      },
      inflection_column: 'camelize',
      inflection_table: 'camelize',
    },
  ],
  external: true,
});

// PG Configuration
//
const pgConfig = {
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
  pool: { min: 0, max: 1 },
};

// Sakila Knex Configuration
//
const sakilaKnexConfig = (parallelId: string) => ({
  ...pgConfig,
  connection: {
    ...pgConfig.connection,
    database: `sakila${parallelId}`,
  },
  pool: { min: 0, max: 1 },
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

const extPgProjectCE = (title, parallelId) => ({
  title,
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

const extSQLiteProjectCE = (title: string, workerId: string) => ({
  title,
  bases: [
    {
      type: 'sqlite3',
      config: {
        client: 'sqlite3',
        connection: {
          client: 'sqlite3',
          connection: {
            filename: sqliteFilePath(workerId),
            database: 'test_sakila',
            multipleStatements: true,
          },
        },
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
  defaultProjectTitle: string;
  defaultTableTitle: string;
}

selectors.setTestIdAttribute('data-testid');
const sqliteFilePath = (workerId: string) => {
  const rootDir = process.cwd();
  return `${rootDir}/../../packages/nocodb/test_sakila_${workerId}.db`;
};

async function localInit({
  workerId,
  isEmptyProject = false,
  projectType = ProjectTypes.DATABASE,
  isSuperUser = false,
  dbType,
}: {
  workerId: string;
  isEmptyProject?: boolean;
  projectType?: ProjectTypes;
  isSuperUser?: boolean;
  dbType?: string;
}) {
  const parallelId = process.env.TEST_PARALLEL_INDEX;

  try {
    let response: AxiosResponse<any, any>;
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

    if (isEE() && api['workspace']) {
      // Delete associated workspace
      // Note that: on worker error, entire thread is reset & worker ID numbering is reset too
      // Hence, workspace delete is based on workerId prefix instead of just workerId
      const ws = await api['workspace'].list();
      for (const w of ws.list) {
        // check if w.title starts with workspaceTitle
        if (w.title.startsWith(`ws_pgExtREST${process.env.TEST_PARALLEL_INDEX}`)) {
          try {
            const projects = await api.workspaceProject.list(w.id);

            for (const project of projects.list) {
              try {
                await api.project.delete(project.id);
              } catch (e) {
                console.log(`Error deleting project: ws delete`, project);
              }
            }

            await api['workspace'].delete(w.id);
          } catch (e) {
            console.log(`Error deleting workspace: ${w.id}`, `user-${parallelId}@nocodb.com`, isSuperUser);
          }
        }
      }
    } else {
      let projects: ProjectListType;
      try {
        projects = await api.project.list();
      } catch (e) {
        console.log('Error fetching projects', e);
      }

      if (projects) {
        for (const p of projects.list) {
          // check if p.title starts with projectTitle
          if (
            p.title.startsWith(`pgExtREST${process.env.TEST_PARALLEL_INDEX}`) ||
            p.title.startsWith(`xcdb_p${process.env.TEST_PARALLEL_INDEX}`)
          ) {
            try {
              await api.project.delete(p.id);
            } catch (e) {
              console.log(`Error deleting project: ${p.id}`, `user-${parallelId}@nocodb.com`, isSuperUser);
            }
          }
        }
      }
    }

    // DB reset
    if (dbType === 'pg' && !isEmptyProject) {
      await resetSakilaPg(`sakila${workerId}`);
    } else if (dbType === 'sqlite') {
      if (await fs.stat(sqliteFilePath(parallelId)).catch(() => null)) {
        await fs.unlink(sqliteFilePath(parallelId));
      }
      if (!isEmptyProject) {
        const testsDir = path.join(process.cwd(), '../../packages/nocodb/tests');
        await fs.copyFile(`${testsDir}/sqlite-sakila-db/sakila.db`, sqliteFilePath(parallelId));
      }
    } else if (dbType === 'mysql') {
      const nc_knex = knex(mysqlConfig);

      try {
        await nc_knex.raw(`USE test_sakila_${parallelId}`);
      } catch (e) {
        await nc_knex.raw(`CREATE DATABASE test_sakila_${parallelId}`);
        await nc_knex.raw(`USE test_sakila_${parallelId}`);
      }
      if (!isEmptyProject) {
        await resetSakilaMysql(nc_knex, parallelId, isEmptyProject);
      }
    }

    let workspace;
    if (isEE() && api['workspace']) {
      // create a new workspace
      workspace = await api['workspace'].create({
        title: workspaceTitle,
      });
    }

    let project;
    if (isEE()) {
      if (isEmptyProject) {
        // create a new project under the workspace we just created
        project = await api.project.create({
          title: projectTitle,
          fk_workspace_id: workspace.id,
          type: projectType,
        });
      } else {
        if ('id' in workspace) {
          // @ts-ignore
          project = await api.project.create(extPgProject(workspace.id, projectTitle, workerId, projectType));
        }
      }
    } else {
      if (isEmptyProject) {
        // create a new project
        project = await api.project.create({
          title: projectTitle,
        });
      } else {
        try {
          project = await api.project.create(
            dbType === 'pg'
              ? extPgProjectCE(projectTitle, workerId)
              : dbType === 'sqlite'
              ? extSQLiteProjectCE(projectTitle, parallelId)
              : extMysqlProject(projectTitle, parallelId)
          );
        } catch (e) {
          console.log(`Error creating project: ${projectTitle}`);
        }
      }
    }

    // get current user information
    const user = await api.auth.me();
    return { data: { project, user, workspace, token }, status: 200 };
  } catch (e) {
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
  let dbType = process.env.CI ? process.env.E2E_DB_TYPE : process.env.E2E_DEV_DB_TYPE;
  dbType = dbType || (isEE() ? 'pg' : 'sqlite');

  let response;

  const workerIndex = process.env.TEST_WORKER_INDEX;
  const parallelIndex = process.env.TEST_PARALLEL_INDEX;

  const workerId = parallelIndex;

  // console.log(process.env.TEST_PARALLEL_INDEX, '#Setup', workerId);

  try {
    // Localised reset logic
    response = await localInit({
      workerId: parallelIndex,
      isEmptyProject,
      projectType,
      isSuperUser,
      dbType,
    });
  } catch (e) {
    console.error(`Error resetting project: ${process.env.TEST_PARALLEL_INDEX}`, e);
  }

  if (response.status !== 200 || !response.data?.token || !response.data?.project) {
    console.error('Failed to reset test data', response.data, response.status, dbType);
    throw new Error('Failed to reset test data');
  }
  const token = response.data.token;

  try {
    const admin = await axios.post('http://localhost:8080/api/v1/auth/user/signin', {
      email: `user@nocodb.com`,
      password: getDefaultPwd(),
    });
    if (!isEE())
      await axios.post(
        `http://localhost:8080/api/v1/license`,
        { key: '' },
        { headers: { 'xc-auth': admin.data.token } }
      );
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
  if (isEE()) {
    switch (project.type) {
      case ProjectTypes.DOCUMENTATION:
        projectUrl = url ? url : `/#/${project.fk_workspace_id}/${project.id}/doc`;
        break;
      case ProjectTypes.DATABASE:
        projectUrl = url ? url : `/#/${project.fk_workspace_id}/${project.id}`;
        break;
      default:
        throw new Error(`Unknown project type: ${project.type}`);
    }
  } else {
    // sample: http://localhost:3000/#/ws/default/project/pdknlfoc5e7bx4w
    projectUrl = url ? url : `/#/nc/${project.id}`;
  }

  await page.goto(projectUrl, { waitUntil: 'networkidle' });
  return {
    project,
    token,
    dbType,
    workerId,
    rootUser,
    workspace,
    defaultProjectTitle: 'Getting Started',
    defaultTableTitle: 'Features',
  } as NcContext;
};

export const unsetup = async (context: NcContext): Promise<void> => {};

// Reference
// packages/nocodb/src/lib/services/test/TestResetService/resetPgSakilaProject.ts

const resetSakilaMysql = async (knex: Knex, parallelId: string, isEmptyProject: boolean) => {
  const testsDir = path.join(process.cwd(), '/../../packages/nocodb/tests');

  try {
    await knex.raw(`DROP DATABASE test_sakila_${parallelId}`);
  } catch (e) {
    console.log('Error dropping db', e);
  }
  await knex.raw(`CREATE DATABASE test_sakila_${parallelId}`);

  if (isEmptyProject) return;

  const trx = await knex.transaction();

  try {
    const schemaFile = await fs.readFile(`${testsDir}/mysql-sakila-db/03-test-sakila-schema.sql`);
    const dataFile = await fs.readFile(`${testsDir}/mysql-sakila-db/04-test-sakila-data.sql`);

    await trx.raw(schemaFile.toString().replace(/test_sakila/g, `test_sakila_${parallelId}`));
    await trx.raw(dataFile.toString().replace(/test_sakila/g, `test_sakila_${parallelId}`));

    await trx.commit();
  } catch (e) {
    console.log('Error resetting mysql db', e);
    await trx.rollback(e);
  }
};

// General purpose API based routines
//

export default setup;
