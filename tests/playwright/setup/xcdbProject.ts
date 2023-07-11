import { Api, WorkspaceListType } from 'nocodb-sdk';
import { isHub } from './db';
let api: Api<any>;

async function createXcdb(token?: string) {
  api = new Api({
    baseURL: `http://localhost:8080/`,
    headers: {
      'xc-auth': token,
    },
  });

  let wsList: WorkspaceListType;
  if (isHub()) {
    wsList = await api.workspace.list();
  }

  const projectList = await api.project.list();
  for (const project of projectList.list) {
    // delete project with title 'xcdb' if it exists
    if (project.title === 'xcdb') {
      await api.project.delete(project.id);
    }
  }

  const project = await api.project.create({ title: 'xcdb', fk_workspace_id: wsList?.list[0].id, type: 'database' });
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
