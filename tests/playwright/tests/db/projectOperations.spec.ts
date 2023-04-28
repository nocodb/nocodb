import { test } from '@playwright/test';
import { DashboardPage } from '../../pages/Dashboard';
import { airtableApiBase, airtableApiKey } from '../../constants';
import { quickVerify } from '../../quickTests/commonTest';
import setup from '../../setup';
import { ToolbarPage } from '../../pages/Dashboard/common/Toolbar';
import { ProjectsPage } from '../../pages/ProjectsPage';
import { Api } from 'nocodb-sdk';

test.describe('Project operations', () => {
  let dashboard: DashboardPage;
  let toolbar: ToolbarPage;
  let context: any;
  let api: Api<any>;
  let projectPage: ProjectsPage;
  test.setTimeout(150000);

  async function deleteIfExists(name: string) {
    try {
      const projectList = await api.project.list();
      const project = projectList.list.find((p: any) => p.title === name);
      if (project) {
        await api.project.delete(project.id);
        console.log('deleted project: ', project.id);
      }
    } catch (e) {
      console.log('Error: ', e);
    }
  }

  test.beforeEach(async ({ page }) => {
    page.setDefaultTimeout(70000);
    context = await setup({ page });
    dashboard = new DashboardPage(page, context.project);
    projectPage = new ProjectsPage(page);
    toolbar = dashboard.grid.toolbar;

    api = new Api({
      baseURL: `http://localhost:8080/`,
      headers: {
        'xc-auth': context.token,
      },
    });
  });

  test('rename, delete', async () => {
    // if project already exists, delete it
    await deleteIfExists('project-firstName');

    await dashboard.clickHome();
    await projectPage.createProject({ name: 'project-firstName', withoutPrefix: true });
    await dashboard.clickHome();
    await projectPage.renameProject({
      title: 'project-firstName',
      newTitle: 'project-rename',
      withoutPrefix: true,
    });
    await dashboard.clickHome();
    await projectPage.openProject({ title: 'project-rename', withoutPrefix: true });
    await dashboard.clickHome();
    await projectPage.deleteProject({ title: 'project-rename', withoutPrefix: true });
  });

  test.only('project_duplicate', async () => {
    // if project already exists, delete it to avoid test failures due to residual data
    const testProjectName = 'project-to-imexp';
    const dupeProjectName: string = testProjectName + ' copy';
    await deleteIfExists(testProjectName);
    await deleteIfExists(dupeProjectName);

    // // data creation for orginial test project
    await createTestProjectWithData();

    // create duplicate
    await dashboard.clickHome();
    await projectPage.duplicateProject({ name: testProjectName, withoutPrefix: true });
    await projectPage.openProject({ title: dupeProjectName, withoutPrefix: true });
    await quickVerify({ dashboard, airtableImport: true, context });

    // cleanup test-data
    await cleanupTestData();

    async function createTestProjectWithData() {
      await dashboard.clickHome();
      await projectPage.createProject({ name: testProjectName, withoutPrefix: true });
      await dashboard.treeView.quickImport({ title: 'Airtable' });
      await dashboard.importAirtable.import({
        key: airtableApiKey,
        baseId: airtableApiBase,
      });
      await dashboard.rootPage.waitForTimeout(1000);
      await quickVerify({ dashboard, airtableImport: true, context });
    }

    async function cleanupTestData() {
      await dashboard.clickHome();
      await projectPage.deleteProject({ title: dupeProjectName, withoutPrefix: true });
      await projectPage.deleteProject({ title: testProjectName, withoutPrefix: true });
    }
  });
});
