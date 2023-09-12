import { Api } from 'nocodb-sdk';
import { NcContext } from './index';
import { isEE } from './db';
let api: Api<any>;

async function createXcdb(context: NcContext) {
  api = new Api({
    baseURL: `http://localhost:8080/`,
    headers: {
      'xc-auth': context.token,
    },
  });

  let projectList;

  if (isEE() && context.workspace?.id) {
    projectList = await api['workspaceProject'].list(context.workspace.id);
  } else {
    projectList = await api.project.list();
  }

  for (const project of projectList.list) {
    // delete project with title 'xcdb' if it exists
    if (project.title === 'xcdb') {
      await api.project.delete(project.id);
    }
  }

  const project = await api.project.create({
    title: 'xcdb',
    type: 'database',
    ...(isEE()
      ? {
          fk_workspace_id: context?.workspace?.id,
        }
      : {}),
  });
  return project;
}

async function deleteXcdb(context: NcContext) {
  api = new Api({
    baseURL: `http://localhost:8080/`,
    headers: {
      'xc-auth': context.token,
    },
  });

  let projectList;

  if (isEE() && context.workspace?.id) {
    projectList = await api['workspaceProject'].list(context.workspace.id);
  } else {
    projectList = await api.project.list();
  }

  for (const project of projectList.list) {
    // delete project with title 'xcdb' if it exists
    if (project.title === 'xcdb') {
      await api.project.delete(project.id);
    }
  }
}

export { createXcdb, deleteXcdb };
