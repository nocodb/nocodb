import { Page } from '@playwright/test';
import axios from 'axios';

export interface NcContext {
  project: any;
  token: string;
  dbType?: string;
}

const setup = async ({page}: {page: Page}): Promise<NcContext> => {
  let dbType = process.env.CI ? process.env.E2E_DB_TYPE : process.env.E2E_DEV_DB_TYPE;
  dbType = dbType || 'mysql';

  const response =  await axios.post(`http://localhost:8080/api/v1/meta/test/reset`, {
    parallelId: process.env.TEST_PARALLEL_INDEX,
    dbType,
  });

  if(response.status !== 200) {
    console.error('Failed to reset test data', response.data);
    throw new Error('Failed to reset test data');
  }
  const token = response.data.token;

  await page.addInitScript(async ({token}) => {
    try {
      let initialLocalStorage = {};
      try {
        initialLocalStorage = JSON.parse(localStorage.getItem('nocodb-gui-v2') || '{}');
      } catch(e) {
        console.error('Failed to parse local storage', e);
      }
      window.localStorage.setItem('nocodb-gui-v2', JSON.stringify({
        ...initialLocalStorage,
        token: token,
      }));
    } catch (e) {
      window.console.log(e);
    }
  }, { token: token });

  const project = response.data.project;

  await page.goto(`/#/nc/${project.id}/auth`);

  return { project, token, dbType } as NcContext;
}

export default setup;