import { test } from '@playwright/test';
import { DashboardPage } from '../../pages/Dashboard';
import setup from '../../setup';

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
    type: 'URL',
  },
];

test.describe('Column menu operations', () => {
  let dashboard: DashboardPage;
  let context: any;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page });
    dashboard = new DashboardPage(page, context.project);
  });

  test('Duplicate fields', async () => {
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

  test('Insert after', async () => {
    await dashboard.treeView.openTable({ title: 'Film' });

    await dashboard.grid.column.create({
      title: 'InsertAfterColumn',
      type: 'SingleLineText',
      insertAfterColumnTitle: 'Title',
    });

    await dashboard.grid.column.create({
      title: 'InsertAfterColumn1',
      type: 'SingleLineText',
      insertAfterColumnTitle: 'Store List',
    });

    await dashboard.closeTab({ title: 'Film' });
  });

  test('Insert before', async () => {
    await dashboard.treeView.openTable({ title: 'Film' });

    await dashboard.grid.column.create({
      title: 'InsertBeforeColumn',
      type: 'SingleLineText',
      insertBeforeColumnTitle: 'Title',
      isDisplayValue: true,
    });

    await dashboard.grid.column.create({
      title: 'InsertBeforeColumn1',
      type: 'SingleLineText',
      insertBeforeColumnTitle: 'Store List',
    });

    await dashboard.closeTab({ title: 'Film' });
  });

  test('Hide column', async () => {
    await dashboard.treeView.openTable({ title: 'Film' });

    await dashboard.grid.column.hideColumn({
      title: 'Title',
      isDisplayValue: true,
    });

    await dashboard.grid.column.hideColumn({
      title: 'Store List',
    });

    await dashboard.closeTab({ title: 'Film' });
  });

  test('Sort column', async () => {
    await dashboard.treeView.openTable({ title: 'Film' });

    await dashboard.grid.column.sortColumn({
      title: 'Title',
      direction: 'asc',
    });

    await dashboard.grid.column.sortColumn({
      title: 'ReleaseYear',
      direction: 'desc',
    });

    await dashboard.closeTab({ title: 'Film' });
  });
});
