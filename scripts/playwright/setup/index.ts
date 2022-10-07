import { Page } from '@playwright/test';
import axios from 'axios';
import { DashboardPage } from '../pages/Dashboard';

const setup = async ({page}: {page: Page}) => {
  const response =  await axios.get('http://localhost:8080/api/v1/meta/test/reset');
  console.log("setup:res:", response);
  if(response.status !== 200) {
    console.error('Failed to reset test data', response);
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

  const project = response.data.projects.find((project) => project.title === 'externalREST');

  await page.goto(`/#/nc/${project.id}/auth`);

  const dashboardPage = new DashboardPage(page, project);
  await dashboardPage.openTable({title: "Country"})

  return { project, token };
}

export default setup;