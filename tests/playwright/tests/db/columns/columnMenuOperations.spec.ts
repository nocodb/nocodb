import { test } from '@playwright/test';
import { DashboardPage } from '../../../pages/Dashboard';
import setup, { unsetup } from '../../../setup';

const columns = [
  // text type
  {
    title: 'Description',
    type: 'LongText',
  },
  // numeric type
  {
    title: 'ReleaseYear',
    type: 'Decimal',
  },
  // cell display (boolean)
  // {
  //   title: 'Checkbox',
  //   type: 'Checkbox',
  // },
  // {
  //   title: 'LongText',
  //   type: 'LongText',
  // },
  // todo: Number column creation not works
  // {
  //   title: 'Number',
  //   type: 'Number',
  // },
  // {
  //   title: 'Email',
  //   type: 'Email',
  // },
  // {
  //   title: 'PhoneNumber',
  //   type: 'PhoneNumber',
  // },
  // {
  //   title: 'Url',
  //   type: 'URL',
  // },
];

test.describe('Column menu operations', () => {
  let dashboard: DashboardPage;
  let context: any;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page, isEmptyProject: false });
    dashboard = new DashboardPage(page, context.base);
  });

  test.afterEach(async () => {
    await unsetup(context);
  });

  test('Duplicate fields', async () => {
    await dashboard.treeView.openTable({ title: 'Film' });

    for (const { title, type } of columns) {
      // Use sakila db fields instead of creating new
      //
      // await dashboard.grid.column.create({
      //   title,
      //   type,
      // });

      await dashboard.grid.column.duplicateColumn({
        title,
      });
      await dashboard.grid.column.duplicateColumn({
        title,
        expectedTitle: `${title} copy_1`,
      });
    }
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
      insertAfterColumnTitle: 'Title',
    });
  });

  test('Insert before', async () => {
    await dashboard.treeView.openTable({ title: 'Film' });

    await dashboard.grid.column.create({
      title: 'InsertBeforeColumn',
      type: 'SingleLineText',
      insertBeforeColumnTitle: 'Title',
      isDisplayValue: true,
    });

    await dashboard.grid.toolbar.fields.toggle({ title: 'Actors', isLocallySaved: false, checked: true });
    await dashboard.grid.column.create({
      title: 'InsertBeforeColumn1',
      type: 'SingleLineText',
      insertBeforeColumnTitle: 'ReleaseYear',
    });
  });

  test('Hide column', async () => {
    await dashboard.treeView.openTable({ title: 'Film' });

    await dashboard.grid.column.hideColumn({
      title: 'Title',
      isDisplayValue: true,
    });

    await dashboard.grid.toolbar.fields.toggle({ title: 'Actors', isLocallySaved: false, checked: true });
    await dashboard.grid.column.hideColumn({
      title: 'RentalDuration',
    });
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
  });
});
