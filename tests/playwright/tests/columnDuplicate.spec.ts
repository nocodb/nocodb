import { test } from '@playwright/test';
import { DashboardPage } from '../pages/Dashboard';
import setup from '../setup';

const columns = [
  {
    title: 'SingleLineText',
    type: 'SingleLineText',
  },
  {
    title: 'LongText',
    type: 'LongText',
  },
  // todo: Number column creation not works
  // {
  //   title: 'Number',
  //   type: 'Number',
  // },
  {
    title: 'Decimal',
    type: 'Decimal',
  },
  {
    title: 'Checkbox',
    type: 'Checkbox',
  },
  {
    title: 'Email',
    type: 'Email',
  },
  {
    title: 'PhoneNumber',
    type: 'PhoneNumber',
  },
  {
    title: 'Url',
    type: 'Url',
  },
];

test.describe('Duplicate column', () => {
  let dashboard: DashboardPage;
  let context: any;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page });
    dashboard = new DashboardPage(page, context.project);
  });

  test('Duplicate text field', async () => {
    await dashboard.treeView.openTable({ title: 'Film' });

    for (const { title, type } of columns) {
      await dashboard.grid.column.create({
        title,
        type,
      });

      await dashboard.grid.column.duplicateColumn({
        title,
      });
      await dashboard.grid.column.duplicateColumn({
        title,
        expectedTitle: `${title}_copy_1`,
      });
    }
    await dashboard.closeTab({ title: 'Film' });
  });
});
