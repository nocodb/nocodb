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

  let baseList;

  if (isEE() && context.workspace?.id) {
    baseList = await api['workspaceBase'].list(context.workspace.id);
  } else {
    baseList = await api.base.list();
  }

  for (const base of baseList.list) {
    // delete base with title 'xcdb' if it exists
    if (base.title === 'xcdb') {
      await api.base.delete(base.id);
    }
  }

  const base = await api.base.create({
    title: 'xcdb',
    type: 'database',
    ...(isEE()
      ? {
          fk_workspace_id: context?.workspace?.id,
        }
      : {}),
  });
  return base;
}

async function deleteXcdb(context: NcContext) {
  api = new Api({
    baseURL: `http://localhost:8080/`,
    headers: {
      'xc-auth': context.token,
    },
  });

  let baseList;

  if (isEE() && context.workspace?.id) {
    baseList = await api['workspaceBase'].list(context.workspace.id);
  } else {
    baseList = await api.base.list();
  }

  for (const base of baseList.list) {
    // delete base with title 'xcdb' if it exists
    if (base.title === 'xcdb') {
      await api.base.delete(base.id);
    }
  }
}

export { createXcdb, deleteXcdb };
