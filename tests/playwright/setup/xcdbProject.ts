import { Api, WorkspaceListType } from 'nocodb-sdk';
import { isHub } from './db';
import { NcContext } from './index';
let api: Api<any>;

async function createXcdb(context: NcContext) {
  api = new Api({
    baseURL: `http://localhost:8080/`,
    headers: {
      'xc-auth': context.token,
    },
  });

  const projectList = await api.project.list();
  for (const project of projectList.list) {
    // delete project with title 'xcdb' if it exists
    if (project.title === 'xcdb') {
      await api.project.delete(project.id);
    }
  }

  const project = await api.project.create({ title: 'xcdb', fk_workspace_id: context.workspace.id, type: 'database' });
  return project;
}

async function deleteXcdb(token?: string) {
  api = new Api({
    baseURL: `http://localhost:8080/`,
    headers: {
      'xc-auth': token,
    },
  });

  const projectList = await api.project.list();
  for (const project of projectList.list) {
    // delete project with title 'xcdb' if it exists
    if (project.title === 'xcdb') {
      await api.project.delete(project.id);
    }
  }
}

export { createXcdb, deleteXcdb };
