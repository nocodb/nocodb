
import { expect, test } from "@playwright/test";
import { DashboardPage } from "../pages/Dashboard";
import { LoginPage } from "../pages/LoginPage";
import { ProjectsPage } from "../pages/ProjectsPage";
import { quickVerify } from "../quickTests/commonTest";
import { NcContext } from "../setup";

test.describe("Quick tests", () => {
  let dashboard: DashboardPage;

  test("Quick tests test", async ({page}) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.fillEmail("user@nocodb.com");
    await loginPage.fillPassword("Password123.");
    await loginPage.submit();

    const projectsPage = new ProjectsPage(page);
    const project = await projectsPage.selectAndGetProject("sample");
    dashboard = new DashboardPage(page, project);
    
    const context: NcContext = {
      project,
      token: '',
      dbType: (process.env.CI ? process.env.E2E_DB_TYPE : process.env.E2E_DEV_DB_TYPE) || 'mysql'
    }
    await quickVerify({dashboard, context});
  });
});
