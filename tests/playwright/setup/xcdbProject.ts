import { Api } from 'nocodb-sdk';
let api: Api;
async function createXcdb(token?: string) {
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

  const project = await api.project.create({ title: 'xcdb' });
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
