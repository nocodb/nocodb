import { test } from '@playwright/test';
import { airtableApiBase, airtableApiKey } from '../constants';
import { DashboardPage } from '../pages/Dashboard';
import { quickVerify } from '../quickTests/commonTest';
import setup from '../setup';
import { isPg, isSqlite } from '../setup/db';

test.describe('Import', () => {
  let dashboard: DashboardPage;
  let context: any;

  test.setTimeout(150000);

  test.beforeEach(async ({ page }) => {
    page.setDefaultTimeout(70000);
    context = await setup({ page, isEmptyProject: true });
    dashboard = new DashboardPage(page, context.project);
  });

  test('Airtable', async () => {
    await dashboard.treeView.quickImport({ title: 'Airtable' });
    await dashboard.importAirtable.import({
      key: airtableApiKey,
      baseId: airtableApiBase,
    });
    await dashboard.rootPage.waitForTimeout(1000);
    await quickVerify({ dashboard, airtableImport: true, context });
  });

  test('CSV', async () => {
    await dashboard.treeView.quickImport({ title: 'CSV file' });
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

    await dashboard.treeView.quickImport({ title: 'Microsoft Excel' });
    await dashboard.importTemplate.import({
      file: `${process.cwd()}/fixtures/sampleFiles/simple.xlsx`,
      result: expected,
    });

    const recordCells = { Number: '1', Float: isSqlite(context) || isPg(context) ? '1.1' : '1.10', Text: 'abc' };

    for (const [key, value] of Object.entries(recordCells)) {
      await dashboard.grid.cell.verify({
        index: 0,
        columnHeader: key,
        value,
      });
    }
  });

  test('JSON', async () => {
    await dashboard.treeView.quickImport({ title: 'JSON file' });
  });
});
