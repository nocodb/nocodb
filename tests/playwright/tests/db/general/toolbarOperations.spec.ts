import { expect, test } from '@playwright/test';
import { DashboardPage } from '../../../pages/Dashboard';
import { ToolbarPage } from '../../../pages/Dashboard/common/Toolbar';
import setup, { unsetup } from '../../../setup';
import { enableQuickRun, isMysql } from '../../../setup/db';
import { UITypes } from 'nocodb-sdk';

test.describe('Toolbar operations (GRID)', () => {
  let dashboard: DashboardPage, toolbar: ToolbarPage;
  let context: any;

  async function validateFirstRow(value: string) {
    await dashboard.grid.cell.verify({
      index: 0,
      columnHeader: 'Country',
      value: value,
    });
  }

  test.beforeEach(async ({ page }) => {
    context = await setup({ page, isEmptyProject: false });
    dashboard = new DashboardPage(page, context.base);
    toolbar = dashboard.grid.toolbar;
  });

  test.afterEach(async () => {
    await unsetup(context);
  });

  test('Create a GroupBy and Verify With Sort, Filter, Hide', async () => {
    if (enableQuickRun()) test.skip();
    // Open Table
    await dashboard.treeView.openTable({ title: 'Film' });

    // Open GroupBy Menu
    await toolbar.clickGroupBy();

    // GroupBy Category Descending Order
    await toolbar.groupBy.add({ title: 'Length', ascending: false, locallySaved: false });

    await toolbar.clickGroupBy();

    // Hide Field and Verify
    await toolbar.fields.toggle({ title: 'Description' });
    await dashboard.grid.column.verify({
      title: 'Description',
      isVisible: false,
    });

    // Filter a Field and Verify
    await toolbar.clickFilter();
    await toolbar.filter.add({
      title: 'Length',
      value: '183',
      operation: '=',
      locallySaved: false,
    });
    await toolbar.clickFilter();

    await dashboard.grid.groupPage.verifyGroupHeader({
      indexMap: [0],
      count: 5,
      title: 'Length',
    });

    await dashboard.grid.groupPage.verifyGroup({
      indexMap: [0],
      value: '183',
    });

    // Add Sort and Verify
    await toolbar.sort.add({ title: 'Title', ascending: false, locallySaved: false });
    await dashboard.grid.groupPage.openGroup({ indexMap: [0] });
    await dashboard.grid.groupPage.validateFirstRow({
      indexMap: [0],
      rowIndex: 0,
      columnHeader: 'Title',
      value: 'YOUNG LANGUAGE',
    });

    // Update Sort and Verify
    await toolbar.sort.update({ index: 1, title: 'Title', ascending: true, locallySaved: false });
    await dashboard.grid.groupPage.openGroup({ indexMap: [0] });
    await dashboard.grid.groupPage.validateFirstRow({
      indexMap: [0],
      rowIndex: 0,
      columnHeader: 'Title',
      value: 'CATCH AMISTAD',
    });

    // Update Hidden Field and Verify
    await toolbar.fields.toggle({ title: 'Length' });
    await dashboard.grid.column.verify({
      title: 'Length',
      isVisible: false,
    });

    // Update Filter and Verify
    await toolbar.clickFilter();
    await toolbar.filter.remove({ networkValidation: false });
    await toolbar.filter.add({
      title: 'Rating',
      value: 'PG-13',
      operation: isMysql(context) ? 'is' : 'is equal',
      dataType: isMysql(context) ? UITypes.SingleSelect : UITypes.SingleLineText,
    });
    await toolbar.clickFilter();
    await dashboard.grid.groupPage.verifyGroupHeader({
      indexMap: [0],
      count: 3,
      title: 'Length',
    });

    await dashboard.grid.groupPage.verifyGroup({
      indexMap: [0],
      value: '185',
    });
    await toolbar.filter.reset({ networkValidation: false });
    await toolbar.clickFilter();
    await toolbar.filter.add({
      title: 'Length',
      value: '183',
      operation: '=',
      locallySaved: false,
    });

    // Remove Sort and Verify
    await toolbar.sort.reset();
    await dashboard.grid.groupPage.openGroup({ indexMap: [0] });
    await dashboard.grid.groupPage.validateFirstRow({
      indexMap: [0],
      rowIndex: 0,
      columnHeader: 'Title',
      value: 'CATCH AMISTAD',
    });

    // Remove Filter and Verify
    await toolbar.filter.reset();
    await dashboard.grid.groupPage.verifyGroupHeader({
      indexMap: [0],
      count: 10,
      title: 'Length',
    });
    await dashboard.grid.groupPage.verifyGroup({
      indexMap: [0],
      value: '185',
    });

    // Remove Hidden Fields and Verify
    await toolbar.fields.toggle({ title: 'Length' });
    await dashboard.grid.column.verify({
      title: 'Length',
      isVisible: true,
    });

    await toolbar.fields.toggle({ title: 'Description' });
    await dashboard.grid.column.verify({
      title: 'Description',
      isVisible: true,
    });
  });

  test('Create Two GroupBy and Verify With Sort, Filter, Hide', async () => {
    if (enableQuickRun()) test.skip();
    // Open Table
    await dashboard.treeView.openTable({ title: 'Film' });

    // Open GroupBy Menu
    await toolbar.clickGroupBy();

    // GroupBy Category Descending Order
    await toolbar.groupBy.add({ title: 'Length', ascending: false, locallySaved: false });
    await toolbar.groupBy.add({ title: 'RentalDuration', ascending: false, locallySaved: false });

    // Close GroupBy Menu
    await toolbar.clickGroupBy();

    // Hide Field and Verify
    await toolbar.fields.toggle({ title: 'Description' });
    await dashboard.grid.column.verify({
      title: 'Description',
      isVisible: false,
    });

    // Filter a Field and Verify
    await toolbar.clickFilter();
    await toolbar.filter.add({
      title: 'RentalDuration',
      value: '3',
      operation: '=',
      locallySaved: false,
    });
    await toolbar.clickFilter();

    await dashboard.grid.groupPage.openGroup({ indexMap: [1, 0] });

    await dashboard.grid.groupPage.verifyGroupHeader({
      indexMap: [1, 0],
      count: 2,
      title: 'RentalDuration',
    });

    await dashboard.grid.groupPage.verifyGroup({
      indexMap: [1, 0],
      value: '3',
    });

    // Add Sort and Verify
    await toolbar.sort.add({ title: 'Title', ascending: false, locallySaved: false });
    await dashboard.grid.groupPage.validateFirstRow({
      indexMap: [1, 0],
      rowIndex: 0,
      columnHeader: 'Title',
      value: 'SONS INTERVIEW',
    });

    // Update Sort and Verify
    await toolbar.sort.update({ index: 1, title: 'Title', ascending: true, locallySaved: false });
    await dashboard.grid.groupPage.validateFirstRow({
      indexMap: [1, 0],
      rowIndex: 0,
      columnHeader: 'Title',
      value: 'KING EVOLUTION',
    });

    // Update Hidden Field and Verify
    await toolbar.fields.toggle({ title: 'Length' });
    await dashboard.grid.column.verify({
      title: 'Length',
      isVisible: false,
    });

    // Update Filter and Verify
    await toolbar.filter.reset({ networkValidation: false });
    await toolbar.clickFilter();
    await toolbar.filter.add({
      title: 'RentalDuration',
      value: '5',
      operation: '=',
      locallySaved: false,
    });
    await toolbar.clickFilter();

    await dashboard.grid.groupPage.openGroup({ indexMap: [1, 0] });

    await dashboard.grid.groupPage.verifyGroupHeader({
      indexMap: [1, 0],
      count: 3,
      title: 'RentalDuration',
    });

    await dashboard.grid.groupPage.verifyGroup({
      indexMap: [1, 0],
      value: '5',
    });

    await toolbar.filter.reset({ networkValidation: false });
    await toolbar.clickFilter();
    await toolbar.filter.add({
      title: 'RentalDuration',
      value: '3',
      operation: '=',
      locallySaved: false,
    });
    await toolbar.clickFilter();

    // Remove Sort and Verify
    await toolbar.sort.reset();
    await dashboard.grid.groupPage.openGroup({ indexMap: [1, 0] });
    await dashboard.grid.groupPage.validateFirstRow({
      indexMap: [1, 0],
      rowIndex: 0,
      columnHeader: 'Title',
      value: 'KING EVOLUTION',
    });

    // Remove Filter and Verify
    await toolbar.filter.reset();
    await dashboard.grid.groupPage.verifyGroupHeader({
      indexMap: [1, 0],
      count: 1,
      title: 'RentalDuration',
    });

    await dashboard.grid.groupPage.verifyGroup({
      indexMap: [1, 0],
      value: '7',
    });

    // Remove Hidden Fields and Verify
    await toolbar.fields.toggle({ title: 'Length' });
    await dashboard.grid.column.verify({
      title: 'Length',
      isVisible: true,
    });

    await toolbar.fields.toggle({ title: 'Description' });
    await dashboard.grid.column.verify({
      title: 'Description',
      isVisible: true,
    });

    await dashboard.closeTab({ title: 'Film' });
  });

  test('Create Three GroupBy and Verify With Sort, Filter, Hide', async () => {
    if (enableQuickRun()) test.skip();
    // Open Table
    await dashboard.treeView.openTable({ title: 'Film' });

    if (isMysql(context)) {
      // change type of ReleaseYear from Year to SingleLineText
      await dashboard.grid.column.openEdit({ title: 'ReleaseYear', type: 'SingleLineText' });
      await dashboard.grid.column.selectType({ type: 'SingleLineText' });
      await dashboard.grid.column.save({ isUpdated: true });
    }

    // Open GroupBy Menu
    await toolbar.clickGroupBy();

    // GroupBy Category Descending Order
    await toolbar.groupBy.add({ title: 'Length', ascending: false, locallySaved: false });
    await toolbar.groupBy.add({ title: 'RentalDuration', ascending: false, locallySaved: false });
    await toolbar.groupBy.add({ title: 'ReleaseYear', ascending: false, locallySaved: false });

    // Hide Field and Verify
    await toolbar.fields.toggle({ title: 'Description' });
    await dashboard.grid.column.verify({
      title: 'Description',
      isVisible: false,
    });

    // Filter a Field and Verify
    await toolbar.clickFilter();
    await toolbar.filter.add({
      title: 'Rating',
      value: 'PG-13',
      operation: isMysql(context) ? 'is' : 'is equal',
      dataType: isMysql(context) ? UITypes.SingleSelect : UITypes.SingleLineText,
      locallySaved: false,
    });
    await toolbar.clickFilter();

    await dashboard.grid.groupPage.openGroup({ indexMap: [5, 0, 0] });

    await dashboard.grid.groupPage.verifyGroupHeader({
      indexMap: [5, 0, 0],
      count: 3,
      title: 'ReleaseYear',
    });

    await dashboard.grid.groupPage.verifyGroup({
      indexMap: [5, 0, 0],
      value: '2006',
    });

    // Add Sort and Verify
    await toolbar.sort.add({ title: 'Title', ascending: false, locallySaved: false });
    await dashboard.grid.groupPage.validateFirstRow({
      indexMap: [5, 0, 0],
      rowIndex: 0,
      columnHeader: 'Title',
      value: 'NASH CHOCOLAT',
    });

    // Update Sort and Verify
    await toolbar.sort.update({ index: 1, title: 'Title', ascending: true, locallySaved: false });
    await dashboard.grid.groupPage.validateFirstRow({
      indexMap: [5, 0, 0],
      rowIndex: 0,
      columnHeader: 'Title',
      value: 'IMPACT ALADDIN',
    });
    // Update Hidden Field and Verify
    await toolbar.fields.toggle({ title: 'Length' });
    await dashboard.grid.column.verify({
      title: 'Length',
      isVisible: false,
    });

    // Update Filter and Verify
    await toolbar.filter.reset();
    await toolbar.clickFilter();

    await toolbar.filter.add({
      title: 'Rating',
      value: 'NC-17',
      operation: isMysql(context) ? 'is' : 'is equal',
      dataType: isMysql(context) ? UITypes.SingleSelect : UITypes.SingleLineText,
      locallySaved: false,
    });
    await toolbar.clickFilter();

    await dashboard.grid.groupPage.openGroup({ indexMap: [5, 0, 0] });

    await dashboard.grid.groupPage.verifyGroupHeader({
      indexMap: [5, 0, 0],
      count: 2,
      title: 'ReleaseYear',
    });

    await dashboard.grid.groupPage.verifyGroup({
      indexMap: [5, 0, 0],
      value: '2006',
    });

    await toolbar.filter.reset();
    await toolbar.clickFilter();

    await toolbar.filter.add({
      title: 'Rating',
      value: 'PG-13',
      operation: isMysql(context) ? 'is' : 'is equal',
      dataType: isMysql(context) ? UITypes.SingleSelect : UITypes.SingleLineText,
      locallySaved: false,
    });
    await toolbar.clickFilter();

    // Remove Sort and Verify
    await toolbar.sort.reset();
    await dashboard.grid.groupPage.openGroup({ indexMap: [5, 0, 0] });
    await dashboard.grid.groupPage.validateFirstRow({
      indexMap: [5, 0, 0],
      rowIndex: 0,
      columnHeader: 'Title',
      value: 'IMPACT ALADDIN',
    });

    // Remove Filter and Verify
    await toolbar.filter.reset();
    await dashboard.grid.groupPage.verifyGroupHeader({
      indexMap: [5, 0, 0],
      count: 6,
      title: 'ReleaseYear',
    });

    await dashboard.grid.groupPage.verifyGroup({
      indexMap: [5, 0, 0],
      value: '2006',
    });

    // Remove Hidden Fields and Verify
    await toolbar.fields.toggle({ title: 'Length' });
    await dashboard.grid.column.verify({
      title: 'Length',
      isVisible: true,
    });

    await toolbar.fields.toggle({ title: 'Description' });
    await dashboard.grid.column.verify({
      title: 'Description',
      isVisible: true,
    });
  });

  test('Update GroupBy and Verify', async () => {
    if (enableQuickRun()) test.skip();
    await dashboard.treeView.openTable({ title: 'Film' });

    if (isMysql(context)) {
      // change type of ReleaseYear from Year to SingleLineText
      await dashboard.grid.column.openEdit({ title: 'ReleaseYear', type: 'SingleLineText' });
      await dashboard.grid.column.selectType({ type: 'SingleLineText' });
      await dashboard.grid.column.save({ isUpdated: true });
    }

    // Open GroupBy Menu
    await toolbar.clickGroupBy();
    await toolbar.groupBy.add({ title: 'Length', ascending: false, locallySaved: false });
    await toolbar.groupBy.add({ title: 'RentalDuration', ascending: false, locallySaved: false });
    await toolbar.clickGroupBy();

    await dashboard.grid.groupPage.openGroup({ indexMap: [5, 0] });

    await dashboard.grid.groupPage.validateFirstRow({
      indexMap: [5, 0],
      rowIndex: 0,
      columnHeader: 'Title',
      value: 'ALLEY EVOLUTION',
    });

    await toolbar.clickGroupBy();

    await toolbar.groupBy.update({ index: 0, title: 'ReleaseYear', ascending: false });

    await toolbar.clickGroupBy();

    await dashboard.grid.groupPage.openGroup({ indexMap: [0, 1] });

    await dashboard.grid.groupPage.validateFirstRow({
      indexMap: [0, 1],
      rowIndex: 0,
      columnHeader: 'Title',
      value: 'ACADEMY DINOSAUR',
    });

    await toolbar.clickGroupBy();

    await toolbar.groupBy.update({ index: 1, title: 'Length', ascending: false });
    await dashboard.grid.groupPage.openGroup({ indexMap: [0, 5] });

    await dashboard.grid.groupPage.validateFirstRow({
      indexMap: [0, 5],
      rowIndex: 0,
      columnHeader: 'Title',
      value: 'ALLEY EVOLUTION',
    });
  });

  test('Change View and Verify GroupBy', async () => {
    if (enableQuickRun()) test.skip();
    await dashboard.treeView.openTable({ title: 'Film' });

    // Open GroupBy Menu
    await toolbar.clickGroupBy();
    await toolbar.groupBy.add({ title: 'Length', ascending: false, locallySaved: false });
    await toolbar.clickGroupBy();

    await dashboard.viewSidebar.createGridView({ title: 'Test' });
    await dashboard.rootPage.waitForTimeout(500);

    await dashboard.treeView.openTable({ title: 'Film' });

    await dashboard.grid.groupPage.verifyGroupHeader({
      indexMap: [0],
      count: 10,
      title: 'Length',
    });

    await dashboard.grid.groupPage.verifyGroup({
      indexMap: [0],
      value: '185',
    });
  });

  test('Duplicate View and Verify GroupBy', async () => {
    if (enableQuickRun()) test.skip();
    await dashboard.treeView.openTable({ title: 'Film' });
    await dashboard.viewSidebar.createGridView({ title: 'Film Grid' });

    // Open GroupBy Menu
    await toolbar.clickGroupBy();
    await toolbar.groupBy.add({ title: 'Length', ascending: false, locallySaved: false });
    await toolbar.clickGroupBy();

    await dashboard.viewSidebar.copyView({ title: 'Film Grid' });

    await dashboard.grid.groupPage.verifyGroupHeader({
      indexMap: [0],
      count: 10,
      title: 'Length',
    });

    await dashboard.grid.groupPage.verifyGroup({
      indexMap: [0],
      value: '185',
    });
  });

  test('Delete GroupBy and Verify', async () => {
    if (enableQuickRun()) test.skip();
    await dashboard.treeView.openTable({ title: 'Film' });

    // Open GroupBy Menu
    await toolbar.clickGroupBy();
    await toolbar.groupBy.add({ title: 'Length', ascending: false, locallySaved: false });
    await toolbar.groupBy.add({ title: 'RentalDuration', ascending: false, locallySaved: false });
    await toolbar.clickGroupBy();

    await dashboard.grid.groupPage.openGroup({ indexMap: [0, 0] });

    await dashboard.grid.groupPage.validateFirstRow({
      indexMap: [0, 0],
      rowIndex: 0,
      columnHeader: 'Title',
      value: 'CONTROL ANTHEM',
    });

    await toolbar.clickGroupBy();
    await toolbar.groupBy.remove({ index: 1 });
    await toolbar.clickGroupBy();

    await dashboard.grid.groupPage.validateFirstRow({
      indexMap: [0],
      rowIndex: 0,
      columnHeader: 'Title',
      value: 'CHICAGO NORTH',
    });

    await toolbar.clickGroupBy();
    await toolbar.groupBy.remove({ index: 0 });
    await toolbar.clickGroupBy();

    await dashboard.grid.cell.verify({
      index: 0,
      columnHeader: 'Title',
      value: 'ACADEMY DINOSAUR',
    });
  });

  test('Hide, Sort, Filter', async () => {
    // close 'Team & Auth' tab
    await dashboard.closeTab({ title: 'Team & Auth' });

    await dashboard.treeView.openTable({ title: 'Country' });

    await dashboard.grid.column.verify({
      title: 'LastUpdate',
      isVisible: true,
    });

    // hide column
    await toolbar.fields.toggle({ title: 'LastUpdate' });
    await dashboard.grid.column.verify({
      title: 'LastUpdate',
      isVisible: false,
    });

    // un-hide column
    await toolbar.fields.toggle({ title: 'LastUpdate' });
    await dashboard.grid.column.verify({
      title: 'LastUpdate',
      isVisible: true,
    });

    await validateFirstRow('Afghanistan');
    // Sort column
    await toolbar.sort.add({ title: 'Country', ascending: false, locallySaved: false });
    await validateFirstRow('Zambia');

    // reset sort
    await toolbar.sort.reset();
    await validateFirstRow('Afghanistan');

    // Filter column
    await toolbar.clickFilter();
    await toolbar.filter.add({
      title: 'Country',
      value: 'India',
      operation: 'is equal',
      locallySaved: false,
    });
    await toolbar.clickFilter();

    await validateFirstRow('India');

    // Reset filter
    await toolbar.filter.reset();
    await validateFirstRow('Afghanistan');

    await dashboard.closeTab({ title: 'Country' });
  });

  test('row height', async () => {
    // define an array of row heights
    const rowHeight = [
      { title: 'Short', height: '1.8rem' },
      { title: 'Medium', height: '3.6rem' },
      { title: 'Tall', height: '7.2rem' },
      { title: 'Extra', height: '10.8rem' },
    ];

    // close 'Team & Auth' tab
    await dashboard.closeTab({ title: 'Team & Auth' });
    await dashboard.treeView.openTable({ title: 'Country' });

    // set row height & verify
    for (let i = 0; i < rowHeight.length; i++) {
      await toolbar.clickRowHeight();
      await toolbar.rowHeight.click({ title: rowHeight[i].title });
      await new Promise(resolve => setTimeout(resolve, 150));
      await dashboard.grid.rowPage.getRecordHeight(0).then(height => {
        expect(height).toBe(rowHeight[i].height);
      });
    }
  });
});
