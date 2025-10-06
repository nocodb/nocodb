import { test } from '@playwright/test';
import { DashboardPage } from '../../../pages/Dashboard';
import setup, { unsetup } from '../../../setup';
import { enableQuickRun } from '../../../setup/db';

test.describe('Button column: Run Script', () => {
  if (enableQuickRun()) test.skip();

  let dashboard: DashboardPage;
  let context: any;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page, isEmptyProject: true });
    dashboard = new DashboardPage(page, context.base);
  });

  test.afterEach(async () => {
    await unsetup(context);
  });

  test('Create button script', async () => {
    await dashboard.treeView.createScript({
      title: 'buttonTest',
      baseTitle: context.base.title,
    });

    await dashboard.treeView.createTable({ title: 'Sheet1', baseTitle: context.base.title });
    await dashboard.treeView.openTable({ title: 'Sheet1', baseTitle: context.base.title });

    await dashboard.grid.column.create({
      title: 'RunScriptButton',
      type: 'Button',
      buttonType: 'Run Script',
      webhookIndex: 0,
    });
  });
});
