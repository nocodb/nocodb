import { expect, test } from '@playwright/test';
import { DashboardPage } from '../../../pages/Dashboard';
import { airtableApiBase, airtableApiKey } from '../../../constants';
import setup, { NcContext, unsetup } from '../../../setup';
import { Api, ProjectListType } from 'nocodb-sdk';
import { BaseInfoApiUtil, ProjectInfo } from '../../../tests/utils/baseInfoApiUtil';
import { deepCompare } from '../../../tests/utils/objectCompareUtil';
import { isEE } from '../../../setup/db';

test.describe('Base operations', () => {
  let dashboard: DashboardPage;
  let context: NcContext;
  let api: Api<any>;
  test.setTimeout(150000);

  async function getProjectList(workspaceId?: string) {
    let baseList: ProjectListType;
    if (isEE() && api['workspaceBase']) {
      baseList = await api['workspaceBase'].list(workspaceId);
    } else {
      baseList = await api.base.list();
    }

    return baseList;
  }

  async function createTestProjectWithData(testProjectName: string) {
    await dashboard.leftSidebar.createProject({ title: testProjectName, context });
    await dashboard.treeView.openProject({ title: testProjectName, context });
    await dashboard.treeView.quickImport({ title: 'Airtable', baseTitle: testProjectName, context });
    await dashboard.importAirtable.import({
      key: airtableApiKey,
      sourceId: airtableApiBase,
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
    dashboard = new DashboardPage(page, context.base);

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
    await dashboard.leftSidebar.createProject({ title: 'base-firstName', context });
    await dashboard.treeView.renameProject({ title: 'base-firstName', newTitle: 'base-rename', context });
    await dashboard.treeView.openProject({ title: 'base-rename', context });
    await dashboard.treeView.deleteProject({ title: 'base-rename', context });
  });

  test('project_duplicate', async () => {
    // if base already exists, delete it to avoid test failures due to residual data
    const random = Math.floor(Math.random() * 1000000);
    const testProjectName = `Base-To-Import-Export-${random}`;
    const scopedProjectName = dashboard.treeView.scopedProjectTitle({
      title: testProjectName,
      context,
    });

    // // data creation for original test base
    await createTestProjectWithData(testProjectName);

    // duplicate duplicate
    await dashboard.treeView.duplicateProject({ title: testProjectName, context });
    await dashboard.treeView.openProject({ title: testProjectName, context });

    // compare
    const baseList = await getProjectList(context.workspace?.id);

    const testProjectId = baseList.list.find((p: any) => p.title === scopedProjectName);
    const dupeProjectId = baseList.list.find((p: any) => p.title.startsWith(scopedProjectName + ' copy'));
    const baseInfoOp: BaseInfoApiUtil = new BaseInfoApiUtil(context.token);
    const original: Promise<ProjectInfo> = baseInfoOp.extractProjectInfo(testProjectId.id);
    const duplicate: Promise<ProjectInfo> = baseInfoOp.extractProjectInfo(dupeProjectId.id);
    await Promise.all([original, duplicate]).then(arr => {
      const ignoredFields: Set<string> = new Set([
        'id',
        'prefix',
        'base_id',
        'fk_view_id',
        'ptn',
        'source_id',
        'table_name',
        'fk_model_id',
        'fk_column_id',
        'fk_cover_image_col_id',
        // // potential bugs
        'created_at',
        'updated_at',
      ]);
      const ignoredKeys: Set<string> = new Set([
        '.base.id',
        '.base.title',
        '.base.tables.0.id',
        '.base.tables.0.source_id',

        // below are potential bugs
        '.base.status',
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
        '.sources.0.config',
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
    // fix me! skip base cleanup
    // await cleanupTestData(dupeProjectId.title, testProjectId.title);
  });
});
