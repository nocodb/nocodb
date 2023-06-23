import { expect, test } from '@playwright/test';
import setup from '../../setup';
import { DashboardPage } from '../../pages/Dashboard';
import { Api } from 'nocodb-sdk';
import { createDemoTable } from '../../setup/demoTable';
import { BulkUpdatePage } from '../../pages/Dashboard/BulkUpdate';

test.describe('Bulk update', () => {
  let dashboard: DashboardPage;
  let bulkUpdateForm: BulkUpdatePage;
  let context: any;
  let api: Api<any>;
  let records: any[];

  test.beforeEach(async ({ page }) => {
    context = await setup({ page, isEmptyProject: true });
    dashboard = new DashboardPage(page, context.project);
    bulkUpdateForm = dashboard.bulkUpdateForm;

    api = new Api({
      baseURL: `http://localhost:8080/`,
      headers: {
        'xc-auth': context.token,
      },
    });

    const table = await createDemoTable({ context, type: 'textBased', recordCnt: 50 });
    records = await api.dbTableRow.list('noco', context.project.id, table.id, { limit: 50 });
    await page.reload();

    await dashboard.closeTab({ title: 'Team & Auth' });
    await dashboard.treeView.openTable({ title: 'textBased' });

    // Open bulk update form
    await dashboard.grid.updateAll();
  });

  test('General- Click to add & remove', async () => {
    let inactiveColumns = await bulkUpdateForm.getInactiveColumns();
    expect(inactiveColumns).toEqual(['SingleLineText', 'MultiLineText', 'Email', 'PhoneNumber', 'URL']);

    let activeColumns = await bulkUpdateForm.getActiveColumns();
    expect(activeColumns).toEqual([]);

    await bulkUpdateForm.addField(0);
    await bulkUpdateForm.addField(0);

    inactiveColumns = await bulkUpdateForm.getInactiveColumns();
    expect(inactiveColumns).toEqual(['Email', 'PhoneNumber', 'URL']);

    activeColumns = await bulkUpdateForm.getActiveColumns();
    expect(activeColumns).toEqual(['SingleLineText', 'MultiLineText']);
  });

  test('General- Drag drop', async () => {
    const src = await bulkUpdateForm.getInactiveColumn(0);
    const dst = await bulkUpdateForm.form;

    await src.dragTo(dst);
    expect(await bulkUpdateForm.getActiveColumns()).toEqual(['SingleLineText']);
    expect(await bulkUpdateForm.getInactiveColumns()).toEqual(['MultiLineText', 'Email', 'PhoneNumber', 'URL']);

    const src2 = await bulkUpdateForm.getActiveColumn(0);
    const dst2 = await bulkUpdateForm.columnsDrawer;

    await src2.dragTo(dst2);
    expect(await bulkUpdateForm.getActiveColumns()).toEqual([]);
    expect(await bulkUpdateForm.getInactiveColumns()).toEqual([
      'SingleLineText',
      'MultiLineText',
      'Email',
      'PhoneNumber',
      'URL',
    ]);
  });
});
