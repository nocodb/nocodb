import { expect, test } from '@playwright/test';
import { DashboardPage } from '../../../pages/Dashboard';
import { airtableApiBase, airtableApiKey } from '../../../constants';
import setup, { unsetup } from '../../../setup';
import { ToolbarPage } from '../../../pages/Dashboard/common/Toolbar';
import { ProjectsPage } from '../../../pages/ProjectsPage';
import { Api, ProjectListType } from 'nocodb-sdk';
import { ProjectInfo, ProjectInfoApiUtil } from '../../../tests/utils/projectInfoApiUtil';
import { deepCompare } from '../../../tests/utils/objectCompareUtil';

// tests covered under tests/playwright/tests/nocohub/hubDashboard.spec.ts
test.describe.skip('Project operations', () => {
  let dashboard: DashboardPage;
  let toolbar: ToolbarPage;
  let context: any;
  let api: Api<any>;
  let projectPage: ProjectsPage;
  test.setTimeout(100000);

  async function deleteIfExists(name: string) {
    try {
      const ws = await api['workspace'].list();
      const projectList = await api['workspaceProject'].list(ws.list[0].id);

      const project = projectList.list.find((p: any) => p.title === name);
      if (project) {
        await api.project.delete(project.id);
        console.log('deleted project: ', project.id);
      }
    } catch (e) {
      console.log('Error: ', e);
    }
  }

  async function createTestProjectWithData(testProjectName: string) {
    await dashboard.clickHome();
    await projectPage.createProject({ name: testProjectName, withoutPrefix: true });
    await dashboard.treeView.quickImport({ title: 'Airtable', projectTitle: context.project.title });
    await dashboard.importAirtable.import({
      key: airtableApiKey,
      baseId: airtableApiBase,
    });
    await dashboard.rootPage.waitForTimeout(1000);
    // await quickVerify({ dashboard, airtableImport: true, context });
  }

  async function cleanupTestData(dupeProjectName: string, testProjectName: string) {
    await dashboard.clickHome();
    await projectPage.deleteProject({ title: dupeProjectName, withoutPrefix: true });
    await projectPage.deleteProject({ title: testProjectName, withoutPrefix: true });
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

  test.afterEach(async () => {
    await unsetup(context);
  });

  test.skip('rename, delete', async () => {
    // Already verified as part of workspace tests

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

  test('project_duplicate', async () => {
    // if project already exists, delete it to avoid test failures due to residual data
    const testProjectName = 'project-to-imexp';
    const dupeProjectName: string = testProjectName + ' copy';
    await deleteIfExists(testProjectName);
    await deleteIfExists(dupeProjectName);

    // // data creation for orginial test project
    await createTestProjectWithData(testProjectName);

    // create duplicate
    await dashboard.clickHome();
    await projectPage.duplicateProject({
      name: testProjectName,
      withoutPrefix: true,
      includeData: true,
      includeViews: true,
    });
    await projectPage.openProject({ title: dupeProjectName, withoutPrefix: true });
    // await quickVerify({ dashboard, airtableImport: true, context });

    // compare
    const ws = await api['workspace'].list();
    const projectList = await api['workspaceProject'].list(ws.list[0].id);

    const testProjectId = await projectList.list.find((p: any) => p.title === testProjectName);
    const dupeProjectId = await projectList.list.find((p: any) => p.title === dupeProjectName);
    const projectInfoOp: ProjectInfoApiUtil = new ProjectInfoApiUtil(context.token);
    const original: Promise<ProjectInfo> = projectInfoOp.extractProjectInfo(testProjectId.id);
    const duplicate: Promise<ProjectInfo> = projectInfoOp.extractProjectInfo(dupeProjectId.id);
    await Promise.all([original, duplicate]).then(arr => {
      const ignoredFields: Set<string> = new Set([
        'id',
        'prefix',
        'project_id',
        'fk_view_id',
        'ptn',
        'base_id',
        'table_name',
        'fk_model_id',
        'fk_column_id',
        'fk_cover_image_col_id',
        // // potential bugs
        'created_at',
        'updated_at',
      ]);
      const ignoredKeys: Set<string> = new Set([
        '.project.id',
        '.project.title',
        '.project.tables.0.id',
        '.project.tables.0.base_id',

        // below are potential bugs
        '.project.status',
        '.tables.0.views.0.view.tn',
        '.tables.0.views.0.view.tn._tn',
        '.tables.0.views.0.view.title',
        '.tables.0.views.0.view._tn',
        '.tables.1.views.0.view.title',
        '.tables.1.views.0.view.tn',
        '.tables.1.views.0.view._tn',
        '.tables.1.views.0.view.tn._tn',
        '.tables.2.views.0.view.tn',
        '.tables.2.views.0.view._tn',
        '.tables.2.views.0.view.title',
        '.bases.0.config',
        '.users.1.roles',
        '.users.2.roles',
      ]);
      const orginalProjectInfo: ProjectInfo = arr[0];
      const duplicateProjectInfo: ProjectInfo = arr[1];
      expect(deepCompare(orginalProjectInfo, duplicateProjectInfo, ignoredFields, ignoredKeys, '', false)).toBeTruthy();
    });

    // cleanup test-data
    await cleanupTestData(dupeProjectName, testProjectName);
  });
});
