import { test } from '@playwright/test';
import { DashboardPage } from '../pages/Dashboard';
import { SettingsPage } from '../pages/Dashboard/Settings';
import setup from '../setup';


test.describe.skip('Views', () => {
  let dashboard: DashboardPage, settings: SettingsPage;
  let context: any;

  test.beforeEach(async ({page}) => {
    context = await setup({ page });
    dashboard = new DashboardPage(page, context.project);
    settings = new SettingsPage(page);
  })

  test('Create, and delete table, verify in audit tab, rename City table and reorder tables', async () => {
  });

});
