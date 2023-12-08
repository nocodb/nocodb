import { expect, test } from '@playwright/test';
import { DashboardPage } from '../pages/Dashboard';
import { LoginPage } from '../pages/LoginPage';
import { ProjectsPage } from '../pages/ProjectsPage';
import { quickVerify } from './commonTest';
import { NcContext } from '../setup';
import { getDefaultPwd } from '../tests/utils/general';

test.describe('Quick tests', () => {
  let dashboard: DashboardPage;

  test('Quick tests test', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.fillEmail({ email: 'user@nocodb.com', withoutPrefix: true });
    await loginPage.fillPassword(getDefaultPwd());
    await loginPage.submit();

    const projectsPage = new ProjectsPage(page);
    const base = await projectsPage.openProject({ title: 'sample', withoutPrefix: true });
    dashboard = new DashboardPage(page, base);

    const context: NcContext = {
      base,
      token: '',
      dbType: (process.env.CI ? process.env.E2E_DB_TYPE : process.env.E2E_DEV_DB_TYPE) || 'mysql',
    };
    await quickVerify({ dashboard, context });
  });
});
