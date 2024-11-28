import { test } from '@playwright/test';
import { DashboardPage } from '../../../pages/Dashboard';
import setup, { unsetup } from '../../../setup';
import { enableQuickRun } from '../../../setup/db';

test.describe('LTAR with filter create & update', () => {
  if (enableQuickRun()) test.skip();

  let dashboard: DashboardPage;
  let context: any;

  // todo: Break the test into smaller tests
  test.setTimeout(150000);

  test.beforeEach(async ({ page }) => {
    context = await setup({ page, isEmptyProject: true });
    dashboard = new DashboardPage(page, context.base);
  });

  test.afterEach(async () => {
    await unsetup(context);
  });

  test('LTAR with filters', async () => {
    await dashboard.treeView.createTable({ title: 'Sheet1', baseTitle: context.base.title });
    // subsequent table creation fails; hence delay
    await dashboard.rootPage.waitForTimeout(1000);
    await dashboard.treeView.createTable({ title: 'Sheet2', baseTitle: context.base.title });

    await dashboard.treeView.openTable({ title: 'Sheet2' });
    await dashboard.grid.addNewRow({ index: 0, value: '2a' });
    await dashboard.grid.addNewRow({ index: 1, value: '2b' });
    await dashboard.grid.addNewRow({ index: 2, value: '2c' });

    await dashboard.treeView.openTable({ title: 'Sheet1' });
    await dashboard.grid.addNewRow({ index: 0, value: '1a' });
    await dashboard.grid.addNewRow({ index: 1, value: '1b' });
    await dashboard.grid.addNewRow({ index: 2, value: '1c' });

    // Create LTAR-HM column
    await dashboard.grid.column.create({
      title: 'Link1-hm',
      type: 'Links',
      childTable: 'Sheet2',
      relationType: 'Has Many',
      ltarFilters: [
        {
          title: 'Id',
          operation: 'eq',
          subOperation: null,
          value: '1',
          locallySaved: true,
          dataType: 'Number',
          openModal: false,
          skipWaitingResponse: true,
        },
      ],
    });
    await dashboard.grid.column.create({
      title: 'Link1-mm',
      type: 'Links',
      childTable: 'Sheet2',
      relationType: 'Many to Many',

      ltarFilters: [
        {
          title: 'Id',
          operation: 'eq',
          subOperation: null,
          value: '2',
          locallySaved: true,
          dataType: 'Number',
          openModal: false,
          skipWaitingResponse: true,
        },
      ],
    });

    await dashboard.rootPage.waitForTimeout(500);

    // Expanded form insert
    await dashboard.grid.footbar.clickAddRecordFromForm();
    await dashboard.expandedForm.fillField({
      columnTitle: 'Title',
      value: '2a',
    });
    await dashboard.expandedForm.fillField({
      columnTitle: 'Link1-hm',
      value: '2a',
      type: 'hasMany',
      ltarCount: 1,
    });
    await dashboard.expandedForm.fillField({
      columnTitle: 'Link1-mm',
      value: '2b',
      type: 'manyToMany',
      ltarCount: 1,
    });
    await dashboard.expandedForm.save();

    // In cell insert
    await dashboard.grid.addNewRow({ index: 4, value: '2b' });
    await dashboard.grid.cell.inCellAdd({ index: 4, columnHeader: 'Link1-hm' });
    await dashboard.linkRecord.select('2a', false);
    await dashboard.grid.cell.inCellAdd({
      index: 1,
      columnHeader: 'Link1-mm',
    });
    await dashboard.linkRecord.select('2b');

    // edit column and delete filter
    await dashboard.grid.column.openEdit({ title: 'Link1-hm' });

    // delete columns
    await dashboard.grid.column.delete({ title: 'Link1-hm' });
    await dashboard.grid.column.delete({ title: 'Link1-mm' });

    // delete table
    await dashboard.treeView.deleteTable({ title: 'Sheet1' });
    await dashboard.treeView.deleteTable({ title: 'Sheet2' });
  });

  test('LTAR with view', async () => {
    await dashboard.treeView.createTable({ title: 'Sheet1', baseTitle: context.base.title });
    // subsequent table creation fails; hence delay
    await dashboard.rootPage.waitForTimeout(1000);
    await dashboard.treeView.createTable({ title: 'Sheet2', baseTitle: context.base.title });

    await dashboard.treeView.openTable({ title: 'Sheet2' });
    await dashboard.grid.addNewRow({ index: 0, value: '2a' });
    await dashboard.grid.addNewRow({ index: 1, value: '2b' });
    await dashboard.grid.addNewRow({ index: 2, value: '2c' });
    await dashboard.viewSidebar.createGridView({
      title: 'Sheet2Grid',
    });

    await dashboard.grid.toolbar.clickFilter();
    await dashboard.grid.toolbar.filter.add({
      title: 'Title',
      value: '2c',
      operation: 'eq',
    });

    await dashboard.rootPage.waitForTimeout(500);
    await dashboard.grid.toolbar.clickFilter();

    await dashboard.treeView.openTable({ title: 'Sheet1' });

    await dashboard.grid.addNewRow({ index: 0, value: '1a' });
    await dashboard.grid.addNewRow({ index: 1, value: '1b' });
    await dashboard.grid.addNewRow({ index: 2, value: '1c' });

    // Create LTAR-HM column
    await dashboard.grid.column.create({
      title: 'Link1-hm',
      type: 'Links',
      childTable: 'Sheet2',
      relationType: 'Has Many',
      ltarView: 'Sheet2Grid',
    });
    await dashboard.grid.column.create({
      title: 'Link1-mm',
      type: 'Links',
      childTable: 'Sheet2',
      relationType: 'Many to Many',
      ltarView: 'Sheet2Grid',
    });

    await dashboard.rootPage.waitForTimeout(500);

    // Expanded form insert
    await dashboard.grid.footbar.clickAddRecordFromForm();
    await dashboard.expandedForm.fillField({
      columnTitle: 'Title',
      value: 'new row',
    });
    await dashboard.expandedForm.fillField({
      columnTitle: 'Link1-hm',
      value: '2c',
      type: 'hasMany',
      ltarCount: 1,
    });
    await dashboard.expandedForm.fillField({
      columnTitle: 'Link1-mm',
      value: '2c',
      type: 'manyToMany',
      ltarCount: 1,
    });
    await dashboard.expandedForm.save();

    // In cell insert
    await dashboard.grid.addNewRow({ index: 4, value: '2c' });
    await dashboard.grid.cell.inCellAdd({ index: 4, columnHeader: 'Link1-hm' });
    await dashboard.linkRecord.select('2c', false);
    await dashboard.grid.cell.inCellAdd({
      index: 1,
      columnHeader: 'Link1-mm',
    });
    await dashboard.linkRecord.select('2c');

    // edit column and delete filter
    await dashboard.grid.column.openEdit({ title: 'Link1-hm' });

    // delete columns
    await dashboard.grid.column.delete({ title: 'Link1-hm' });
    await dashboard.grid.column.delete({ title: 'Link1-mm' });

    // delete table
    await dashboard.treeView.deleteTable({ title: 'Sheet1' });
    await dashboard.treeView.deleteTable({ title: 'Sheet2' });
  });
});
