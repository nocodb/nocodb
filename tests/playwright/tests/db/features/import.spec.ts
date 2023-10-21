import { test } from '@playwright/test';
import { airtableApiBase, airtableApiKey } from '../../../constants';
import { DashboardPage } from '../../../pages/Dashboard';
import { quickVerify } from '../../../quickTests/commonTest';
import setup, { NcContext, unsetup } from '../../../setup';
import { enableQuickRun } from '../../../setup/db';

test.describe('Import', () => {
  if (enableQuickRun()) test.skip();
  let dashboard: DashboardPage;
  let context: NcContext;

  test.setTimeout(150000);

  test.beforeEach(async ({ page }) => {
    page.setDefaultTimeout(70000);
    context = await setup({ page, isEmptyProject: true });
    dashboard = new DashboardPage(page, context.base);
  });

  test.afterEach(async () => {
    await unsetup(context);
  });

  test('Airtable', async () => {
    await dashboard.treeView.quickImport({ title: 'Airtable', baseTitle: context.base.title, context });
    await dashboard.importAirtable.import({
      key: airtableApiKey,
      sourceId: airtableApiBase,
    });
    await dashboard.rootPage.waitForTimeout(1000);
    await quickVerify({ dashboard, airtableImport: true, context });
  });

  test('CSV', async () => {
    await dashboard.treeView.quickImport({ title: 'CSV file', baseTitle: context.base.title, context });
  });

  test('Excel', async () => {
    const col = [
      { type: 'Number', name: 'number' },
      { type: 'Decimal', name: 'float' },
      { type: 'SingleLineText', name: 'text' },
    ];
    const expected = [
      { name: 'Sheet2', columns: col },
      { name: 'Sheet3', columns: col },
      { name: 'Sheet4', columns: col },
    ];

    await dashboard.treeView.quickImport({ title: 'Microsoft Excel', baseTitle: context.base.title, context });
    await dashboard.importTemplate.import({
      file: `${process.cwd()}/fixtures/sampleFiles/simple.xlsx`,
      result: expected,
    });

    await dashboard.treeView.openTable({ title: 'Sheet2' });

    const recordCells = { Number: '1', Float: '1.1', Text: 'abc' };

    for (const [key, value] of Object.entries(recordCells)) {
      await dashboard.grid.cell.verify({
        index: 0,
        columnHeader: key,
        value,
      });
    }
  });

  test('JSON', async () => {
    await dashboard.treeView.quickImport({ title: 'JSON file', baseTitle: context.base.title, context });
  });
});
