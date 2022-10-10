import { test } from '@playwright/test';
import { DashboardPage } from '../pages/Dashboard';
import { SettingsPage } from '../pages/Settings';
import setup from '../setup';


test.describe('Table Operations', () => {
  let dashboard: DashboardPage, settings: SettingsPage;
  let context: any;

  test.beforeEach(async ({page}) => {
    context = await setup({ page });
    dashboard = new DashboardPage(page, context.project);
    settings = new SettingsPage(page);
  })

  test('Create, and delete table, verify in audit tab, and rename City table', async () => {
    await dashboard.createTable({title: "tablex"});
    await dashboard.verifyTableExistsInSidebar({title: "tablex"});
    
    await dashboard.deleteTable({title: "tablex"});
    await dashboard.verifyTableDoesNotExistInSidebar({title: "tablex"});
    
    await dashboard.gotoSettings();
    await settings.selectTab({title: 'Audit'});
    await settings.audit.verifyRow({index: 0, opType: 'TABLE', opSubtype: 'DELETED', user: 'user@nocodb.com'});
    await settings.audit.verifyRow({index: 1, opType: 'TABLE', opSubtype: 'CREATED', user: 'user@nocodb.com'});
    await settings.close();

    await dashboard.renameTable({title: "City", newTitle: "Cityx"});
    await dashboard.verifyTableExistsInSidebar({title: "Cityx"});
  });

});
