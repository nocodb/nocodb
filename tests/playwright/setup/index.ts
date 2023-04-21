import { Page, selectors } from '@playwright/test';
import axios from 'axios';
import { Api, ProjectType, ProjectTypes, UserType, WorkspaceType } from 'nocodb-sdk';
import { getDefaultPwd } from '../tests/utils/general';
let api: Api<any>;

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

const enableLocalInit = false;
async function localInit({ parallelId = process.env.TEST_PARALLEL_INDEX }: { parallelId: string }) {
  const response = await axios.post('http://localhost:8080/api/v1/auth/user/signin', {
    email: 'user@nocodb.com',
    password: getDefaultPwd(),
  });
  const token = response.data.token;

  api = new Api({
    baseURL: `http://localhost:8080/`,
    headers: {
      'xc-auth': token,
    },
  });

  const workspaceTitle = `ws_pgExtREST${parallelId}`;
  const projectTitle = `pgExtREST${parallelId}`;

  // get workspace list
  const ws = await api.workspace.list();
  // delete all workspaces
  for (const w of ws.list) {
    await api.workspace.delete(w.id);
  }
  // create a new workspace
  const workspace = await api.workspace.create({
    title: workspaceTitle,
  });
  // create a new project under the workspace we just created
  const project = await api.project.create({
    title: projectTitle,
    // @ts-expect-error
    fk_workspace_id: workspace.id,
    type: 'database',
  });

  // get all users list
  // const users = await api.workspaceUser.list(newWs.id);
  // delete all users except user@nocodb.com
  // for (const u of users.list) {
  //   if (u.email !== 'user@nocodb.com') {
  //     await api.workspaceUser.delete(newWs.id, u.id);
  //   }
  // }

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

  const workerIndex = process.env.TEST_PARALLEL_INDEX;
  if (!workerCount[workerIndex]) {
    workerCount[workerIndex] = 0;
  }
  workerCount[workerIndex]++;
  const workerId = String(Number(workerIndex) + Number(workerCount[workerIndex]) * 4);

  let response;
  try {
    if (isEmptyProject && enableLocalInit) {
      response = await localInit({ parallelId: process.env.TEST_PARALLEL_INDEX });
    } else {
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
