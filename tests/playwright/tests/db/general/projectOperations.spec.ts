import { expect, test } from '@playwright/test';
import { DashboardPage } from '../../../pages/Dashboard';
import { airtableApiBase, airtableApiKey } from '../../../constants';
import setup, { NcContext, unsetup } from '../../../setup';
import { Api, ProjectListType } from 'nocodb-sdk';
import { ProjectInfo, ProjectInfoApiUtil } from '../../../tests/utils/projectInfoApiUtil';
import { deepCompare } from '../../../tests/utils/objectCompareUtil';
import { isEE } from '../../../setup/db';

test.describe('Project operations', () => {
  let dashboard: DashboardPage;
  let context: NcContext;
  let api: Api<any>;
  test.setTimeout(150000);

  async function getProjectList(workspaceId?: string) {
    let projectList: ProjectListType;
    if (isEE() && api['workspaceProject']) {
      projectList = await api['workspaceProject'].list(workspaceId);
    } else {
      projectList = await api.project.list();
    }

    return projectList;
  }

  async function createTestProjectWithData(testProjectName: string) {
    await dashboard.leftSidebar.createProject({ title: testProjectName, context });
    await dashboard.treeView.openProject({ title: testProjectName, context });
    await dashboard.treeView.quickImport({ title: 'Airtable', projectTitle: testProjectName, context });
    await dashboard.importAirtable.import({
      key: airtableApiKey,
      baseId: airtableApiBase,
    });
    await dashboard.rootPage.waitForTimeout(1000);
  }

  async function cleanupTestData(dupeProjectName: string, testProjectName: string) {
    await dashboard.treeView.deleteProject({ title: dupeProjectName, context });
    await dashboard.treeView.deleteProject({ title: testProjectName, context });
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
    await dashboard.leftSidebar.createProject({ title: 'project-firstName', context });
    await dashboard.treeView.renameProject({ title: 'project-firstName', newTitle: 'project-rename', context });
    await dashboard.treeView.openProject({ title: 'project-rename', context });
    await dashboard.treeView.deleteProject({ title: 'project-rename', context });
  });

  test('project_duplicate', async () => {
    // if project already exists, delete it to avoid test failures due to residual data
    const random = Math.floor(Math.random() * 1000000);
    const testProjectName = `Project-To-Import-Export-${random}`;
    const scopedProjectName = dashboard.treeView.scopedProjectTitle({
      title: testProjectName,
      context,
    });

    // // data creation for original test project
    await createTestProjectWithData(testProjectName);

    // duplicate duplicate
    await dashboard.treeView.duplicateProject({ title: testProjectName, context });
    await dashboard.treeView.openProject({ title: testProjectName, context });

    // compare
    const projectList = await getProjectList(context.workspace?.id);

    const testProjectId = projectList.list.find((p: any) => p.title === scopedProjectName);
    const dupeProjectId = projectList.list.find((p: any) => p.title.startsWith(scopedProjectName + ' copy'));
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
