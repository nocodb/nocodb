import { Page, TestInfo } from '@playwright/test';
import axios from 'axios';
import { DashboardPage } from '../pages/Dashboard';

const setup = async ({page, typeOnLocalSetup}: {page: Page, typeOnLocalSetup?: string}) => {
  const type = process.env.CI ? process.env.E2E_TYPE : typeOnLocalSetup;
  const response =  await axios.post(`http://localhost:8080/api/v1/meta/test/reset`, {
    parallelId: process.env.TEST_PARALLEL_INDEX,
    type: type ?? 'sqlite',
  });

  if(response.status !== 200) {
    console.error('Failed to reset test data', response.data);
    throw new Error('Failed to reset test data');
  }
  const token = response.data.token;

  await page.addInitScript(async ({token}) => {
    try {
      window.localStorage.setItem('nocodb-gui-v2', JSON.stringify({
        token: token,
      }));
    } catch (e) {
      window.console.log(e);
    }
  }, { token: token });

  const project = response.data.project;

  await page.goto(`/#/nc/${project.id}/auth`);

  const dashboardPage = new DashboardPage(page, project);
  await dashboardPage.openTable({title: "Country"})

  return { project, token };
}

export default setup;