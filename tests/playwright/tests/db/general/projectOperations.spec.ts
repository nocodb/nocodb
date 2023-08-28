import { expect, test } from '@playwright/test';
import { DashboardPage } from '../../../pages/Dashboard';
import { airtableApiBase, airtableApiKey } from '../../../constants';
import setup, { unsetup } from '../../../setup';
import { Api, ProjectListType } from 'nocodb-sdk';
import { ProjectInfo, ProjectInfoApiUtil } from '../../../tests/utils/projectInfoApiUtil';
import { deepCompare } from '../../../tests/utils/objectCompareUtil';
import { isEE } from '../../../setup/db';

test.describe('Project operations', () => {
  let dashboard: DashboardPage;
  let context: any;
  let api: Api<any>;
  test.setTimeout(100000);

  async function getProjectList() {
    let projectList: ProjectListType;
    if (isEE() && api['workspaceProject']) {
      const ws = await api['workspace'].list();
      projectList = await api['workspaceProject'].list(ws.list[1].id);
    } else {
      projectList = await api.project.list();
    }
    return projectList;
  }
  async function deleteIfExists(name: string) {
    try {
      const projectList = await getProjectList();

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
    await dashboard.leftSidebar.createProject({ title: testProjectName });
    await dashboard.treeView.openProject({ title: testProjectName });
    await dashboard.treeView.quickImport({ title: 'Airtable', projectTitle: testProjectName });
    await dashboard.importAirtable.import({
      key: airtableApiKey,
      baseId: airtableApiBase,
    });
    await dashboard.rootPage.waitForTimeout(1000);
  }

  async function cleanupTestData(dupeProjectName: string, testProjectName: string) {
    await dashboard.treeView.deleteProject({ title: dupeProjectName });
    await dashboard.treeView.deleteProject({ title: testProjectName });
  }

  test.beforeEach(async ({ page }) => {
    page.setDefaultTimeout(70000);
    context = await setup({ page });
    dashboard = new DashboardPage(page, context.project);

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

  test('rename, delete', async () => {
    // if project already exists, delete it
    await deleteIfExists('project-firstName');

    await dashboard.leftSidebar.createProject({ title: 'project-firstName' });
    await dashboard.treeView.renameProject({ title: 'project-firstName', newTitle: 'project-rename' });
    await dashboard.treeView.openProject({ title: 'project-rename' });
    await dashboard.treeView.deleteProject({ title: 'project-rename' });
  });

  test('project_duplicate', async () => {
    // if project already exists, delete it to avoid test failures due to residual data
    const testProjectName = 'Project-To-Import-Export';
    const dupeProjectName: string = testProjectName + ' copy';
    await deleteIfExists(testProjectName);
    await deleteIfExists(dupeProjectName);

    // // data creation for original test project
    await createTestProjectWithData(testProjectName);

    // duplicate duplicate
    await dashboard.treeView.duplicateProject({ title: testProjectName });
    await dashboard.treeView.openProject({ title: testProjectName });

    // compare
    const projectList = await getProjectList();

    const testProjectId = projectList.list.find((p: any) => p.title === testProjectName);
    const dupeProjectId = projectList.list.find((p: any) => p.title.startsWith(testProjectName + ' copy'));
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
      const originalProjectInfo: ProjectInfo = arr[0];
      const duplicateProjectInfo: ProjectInfo = arr[1];
      expect(
        deepCompare(originalProjectInfo, duplicateProjectInfo, ignoredFields, ignoredKeys, '', false)
      ).toBeTruthy();
    });

    // cleanup test-data
    // fix me! skip project cleanup
    // await cleanupTestData(dupeProjectId.title, testProjectId.title);
  });
});
