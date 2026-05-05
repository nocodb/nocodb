import { expect, test } from '@playwright/test';
import { DashboardPage } from '../../../pages/Dashboard';
import setup, { unsetup } from '../../../setup';
import { enableQuickRun, isEE } from '../../../setup/db';

test.describe('LTAR create & update', () => {
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

  test('LTAR', async () => {
    await dashboard.treeView.createTable({ title: 'Sheet1', baseTitle: context.base.title });
    // subsequent table creation fails; hence delay
    await dashboard.rootPage.waitForTimeout(1000);
    await dashboard.treeView.createTable({ title: 'Sheet2', baseTitle: context.base.title });

    await dashboard.treeView.openTable({ title: 'Sheet1', baseTitle: context.base.title });
    await dashboard.grid.addNewRow({ index: 0, value: '1a' });
    await dashboard.grid.addNewRow({ index: 1, value: '1b' });
    await dashboard.grid.addNewRow({ index: 2, value: '1c' });

    // Create LTAR-OM column
    await dashboard.grid.column.create({
      title: 'Link1-2om',
      type: 'LinkToAnotherRecord',
      childTable: 'Sheet2',
      relationType: 'One to Many',
    });
    await dashboard.grid.column.create({
      title: 'Link1-2mm',
      type: 'LinkToAnotherRecord',
      childTable: 'Sheet2',
      relationType: 'Many to Many',
    });

    await dashboard.treeView.openTable({ title: 'Sheet2', networkResponse: false, baseTitle: context.base.title });
    await dashboard.grid.column.create({
      title: 'Link2-1om',
      type: 'LinkToAnotherRecord',
      childTable: 'Sheet1',
      relationType: 'One to Many',
    });

    // Sheet2 now has all 3 column categories : OM, MO, MM

    // Verify fields and toggle the visibility
    await dashboard.grid.toolbar.clickFields();
    for (const title of ['Sheet1', 'Sheet1s']) {
      // verify that fields are enabled
      await dashboard.grid.toolbar.fields.verify({ title, checked: true });
      // await dashboard.grid.toolbar.fields.click({ title, isLocallySaved: false });
    }
    await dashboard.grid.toolbar.clickFields();

    // Expanded form insert
    await dashboard.grid.footbar.clickAddRecordFromForm();
    await dashboard.expandedForm.fillField({
      columnTitle: 'Title',
      value: '2a',
    });
    await dashboard.expandedForm.fillField({
      columnTitle: 'Sheet1',
      value: '1a',
      type: 'belongsTo',
    });
    await dashboard.expandedForm.fillField({
      columnTitle: 'Sheet1s',
      value: '1a',
      type: 'manyToMany',
    });
    await dashboard.expandedForm.fillField({
      columnTitle: 'Link2-1om',
      value: '1a',
      type: 'hasMany',
    });
    await dashboard.expandedForm.save();

    // In cell insert
    await dashboard.grid.addNewRow({ index: 1, value: '2b' });
    await dashboard.grid.cell.inCellAdd({ index: 1, columnHeader: 'Sheet1' });
    await dashboard.linkRecord.select('1b');
    await dashboard.grid.cell.inCellAdd({
      index: 1,
      columnHeader: 'Sheet1s',
    });
    await dashboard.linkRecord.select('1b');
    await dashboard.grid.cell.inCellAdd({
      index: 1,
      columnHeader: 'Link2-1om',
    });
    await dashboard.linkRecord.select('1b');

    // Expand record insert
    await dashboard.grid.addNewRow({ index: 2, value: '2c-temp' });
    await dashboard.grid.openExpandedRow({ index: 2 });

    await dashboard.expandedForm.fillField({
      columnTitle: 'Sheet1',
      value: '1c',
      type: 'belongsTo',
    });
    await dashboard.expandedForm.fillField({
      columnTitle: 'Sheet1s',
      value: '1c',
      type: 'manyToMany',
    });
    await dashboard.expandedForm.fillField({
      columnTitle: 'Link2-1om',
      value: '1c',
      type: 'hasMany',
    });
    await dashboard.expandedForm.fillField({
      columnTitle: 'Title',
      value: '2c',
      type: 'text',
    });

    await dashboard.rootPage.waitForTimeout(1000);

    await dashboard.expandedForm.save();

    const expected = [
      [['1a'], ['1b'], ['1c']],
      [['1a'], ['1b'], ['1c']],
      [['1a'], ['1b'], ['1c']],
    ];
    const colHeaders = ['Sheet1', 'Sheet1s', 'Link2-1om'];

    // verify LTAR cell values
    for (let i = 0; i < expected.length; i++) {
      for (let j = 0; j < expected[i].length; j++) {
        await dashboard.grid.cell.verifyVirtualCell({
          index: j,
          columnHeader: colHeaders[i],
          count: 1,
          value: expected[i][j],
          type: i === 0 ? 'bt' : undefined,
          options: { singular: 'Sheet1', plural: 'Sheet1s' },
        });
      }
    }

    await dashboard.treeView.openTable({ title: 'Sheet1', baseTitle: context.base.title });

    // Verify fields and toggle the visibility
    await dashboard.grid.toolbar.clickFields();
    await dashboard.grid.toolbar.fields.verify({ title: 'Sheet2', checked: true });
    // await dashboard.grid.toolbar.fields.click({ title: 'Sheet2', isLocallySaved: false });
    await dashboard.grid.toolbar.clickFields();

    const expected2 = [
      [['2a'], ['2b'], ['2c']],
      [['2a'], ['2b'], ['2c']],
      [['2a'], ['2b'], ['2c']],
    ];
    const colHeaders2 = ['Link1-2om', 'Link1-2mm', 'Sheet2'];

    // verify LTAR cell values
    for (let i = 0; i < expected2.length; i++) {
      for (let j = 0; j < expected2[i].length; j++) {
        await dashboard.grid.cell.verifyVirtualCell({
          index: j,
          columnHeader: colHeaders2[i],
          count: 1,
          value: expected2[i][j],
          type: i === 2 ? 'bt' : undefined,
          options: { singular: 'Sheet2', plural: 'Sheet2s' },
        });
      }
    }

    // Unlink LTAR cells
    for (let i = 0; i < expected2.length; i++) {
      for (let j = 0; j < expected2[i].length; j++) {
        await dashboard.rootPage.waitForTimeout(500);
        await dashboard.grid.cell.unlinkVirtualCell({
          index: j,
          columnHeader: colHeaders2[i],
        });
      }
    }

    // delete columns
    await dashboard.grid.column.delete({ title: 'Link1-2om' });
    await dashboard.grid.column.delete({ title: 'Link1-2mm' });
    await dashboard.grid.column.delete({ title: 'Sheet2' });

    // delete table
    await dashboard.treeView.deleteTable({ title: 'Sheet1' });
    await dashboard.treeView.deleteTable({ title: 'Sheet2' });
  });
});

test.describe('Links after edit record', () => {
  let dashboard: DashboardPage;
  let context: any;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page, isEmptyProject: false });
    dashboard = new DashboardPage(page, context.base);
  });

  test.afterEach(async () => {
    await unsetup(context);
  });

  async function verifyRow(param: {
    index: number;
    value: {
      Country: string;
      formula?: string;
      SLT?: string;
      Cities: string[];
    };
  }) {
    await dashboard.grid.cell.verify({
      index: param.index,
      columnHeader: 'Country',
      value: param.value.Country,
    });
    if (param.value.formula) {
      await dashboard.grid.cell.verify({
        index: param.index,
        columnHeader: 'formula',
        value: param.value.formula,
      });
    }
    await dashboard.grid.cell.verifyVirtualCell({
      index: param.index,
      columnHeader: 'Cities',
      count: param.value.Cities.length,
      options: { singular: 'City', plural: 'Cities' },
    });

    if (param.value.SLT) {
      await dashboard.grid.cell.verify({
        index: param.index,
        columnHeader: 'SLT',
        value: param.value.SLT,
      });
    }
  }

  /**
   * Scope:
   *  - Verify LTAR and lookup cell after updating any non-virtual column
   *  - Verify the formula cell in which the updated cell is referring
   *  - Verify other non-virtual cells
   *
   *  https://github.com/nocodb/nocodb/issues/4220
   *
   */
  test('Existing LTAR table verification', async () => {
    // open table
    await dashboard.treeView.openTable({ title: 'Country', baseTitle: context.base.title });
    await verifyRow({
      index: 0,
      value: {
        Country: 'Afghanistan',
        Cities: ['Kabul'],
      },
    });
    await verifyRow({
      index: 1,
      value: {
        Country: 'Algeria',
        Cities: ['Batna', 'Bchar', 'Skikda'],
      },
    });

    // create new columns
    await dashboard.grid.column.create({
      title: 'SLT',
      type: 'SingleLineText',
    });
    await dashboard.grid.column.create({
      title: 'formula',
      type: 'Formula',
      formula: "CONCAT({Country}, ' ', {SLT})",
    });

    // insert new content into a cell
    await dashboard.grid.editRow({
      index: 0,
      columnHeader: 'SLT',
      value: 'test',
    });

    await verifyRow({
      index: 0,
      value: {
        Country: 'Afghanistan',
        Cities: ['Kabul'],
        SLT: 'test',
        formula: 'Afghanistan test',
      },
    });

    // edit record
    await dashboard.grid.editRow({
      index: 0,
      columnHeader: 'Country',
      value: 'Afghanistan2',
    });
    await verifyRow({
      index: 0,
      value: {
        Country: 'Afghanistan2',
        Cities: ['Kabul'],
        SLT: 'test',
        formula: 'Afghanistan2 test',
      },
    });

    // Delete cell contents and verify
    await dashboard.grid.cell.click({ index: 0, columnHeader: 'SLT' });
    // trigger delete button key
    await dashboard.rootPage.keyboard.press('Delete');
    // Verify other non-virtual cells
    await verifyRow({
      index: 0,
      value: {
        Country: 'Afghanistan2',
        Cities: ['Kabul'],
        SLT: '',
        formula: 'Afghanistan2',
      },
    });
  });
});

test.describe('LTAR custom display field', () => {
  // Custom display field toggle is hidden in CE (v-if="isEeUI"). Skip the
  // whole suite on non-EE runs — the dropdown the test clicks doesn't exist.
  if (!isEE()) test.skip();

  let dashboard: DashboardPage;
  let context: any;

  test.setTimeout(120000);

  test.beforeEach(async ({ page }) => {
    context = await setup({ page, isEmptyProject: true });
    dashboard = new DashboardPage(page, context.base);
  });

  test.afterEach(async () => {
    await unsetup(context);
  });

  test('Set custom display field and verify dropdown shows it', async () => {
    // Create two tables
    await dashboard.treeView.createTable({ title: 'Products', baseTitle: context.base.title });
    await dashboard.rootPage.waitForTimeout(1000);
    await dashboard.treeView.createTable({ title: 'Categories', baseTitle: context.base.title });

    // Add a Description column to Categories
    await dashboard.treeView.openTable({ title: 'Categories', baseTitle: context.base.title });
    await dashboard.grid.column.create({ title: 'Description', type: 'SingleLineText' });

    // Add rows to Categories with Title and Description
    await dashboard.grid.addNewRow({ index: 0, value: 'Cat-A' });
    await dashboard.grid.editRow({ index: 0, columnHeader: 'Description', value: 'Desc-A' });
    await dashboard.grid.addNewRow({ index: 1, value: 'Cat-B' });
    await dashboard.grid.editRow({ index: 1, columnHeader: 'Description', value: 'Desc-B' });

    // Switch to Products table and create LTAR column
    await dashboard.treeView.openTable({ title: 'Products', baseTitle: context.base.title });
    await dashboard.grid.column.create({
      title: 'Category',
      type: 'LinkToAnotherRecord',
      childTable: 'Categories',
      relationType: 'Many to Many',
    });

    // Add a row and link a record — should show PV (Title) by default
    await dashboard.grid.addNewRow({ index: 0, value: 'Product-1' });
    await dashboard.grid.cell.inCellAdd({ index: 0, columnHeader: 'Category' });

    // Verify dropdown shows PV values (Title column)
    const linkRecord = dashboard.get().locator('.nc-modal-link-record').last();
    await linkRecord.waitFor({ state: 'visible' });
    const listItems = linkRecord.getByTestId('nc-excluded-list-item');
    await expect(listItems.first().locator('.nc-display-value')).toContainText('Cat-A');

    // Link Cat-A
    await dashboard.linkRecord.select('Cat-A');

    // Verify the cell chip shows PV value
    await dashboard.grid.cell.verifyVirtualCell({
      index: 0,
      columnHeader: 'Category',
      count: 1,
      value: ['Cat-A'],
      options: { singular: 'Category', plural: 'Categories' },
    });

    // Now edit the LTAR column to use custom display field (Description)
    await dashboard.grid.column.openEdit({ title: 'Category' });
    await dashboard.rootPage.waitForTimeout(500);

    // Toggle "Use custom display field"
    const columnForm = dashboard.rootPage.locator('form[data-testid="add-or-edit-column"]');
    await columnForm.getByTestId('nc-use-custom-display-field').click();
    await dashboard.rootPage.waitForTimeout(500);

    // Open the field selector NcSelect (it appears after toggle is enabled)
    await columnForm
      .locator('.ant-select', { has: dashboard.rootPage.locator('.ant-select-selection-search') })
      .last()
      .click();
    await dashboard.rootPage.waitForTimeout(300);

    // Select "Description" from the dropdown
    await dashboard.rootPage
      .locator('.nc-dropdown-ltar-display-value-field .ant-select-item')
      .filter({ hasText: 'Description' })
      .click();
    await dashboard.rootPage.waitForTimeout(500);

    // Save the column
    await dashboard.grid.column.save({ isUpdated: true });

    // Now open the link record dropdown again to verify it shows Description values
    await dashboard.grid.addNewRow({ index: 1, value: 'Product-2' });
    await dashboard.grid.cell.inCellAdd({ index: 1, columnHeader: 'Category' });

    const linkRecord2 = dashboard.get().locator('.nc-modal-link-record').last();
    await linkRecord2.waitFor({ state: 'visible' });
    const listItems2 = linkRecord2.getByTestId('nc-excluded-list-item');

    // The display value should now show Description field values instead of Title
    await expect(listItems2.first().locator('.nc-display-value')).toContainText('Desc-');
    await dashboard.linkRecord.select('Desc-B', true);

    // Verify cell chip now shows Description value
    await dashboard.grid.cell.verifyVirtualCell({
      index: 1,
      columnHeader: 'Category',
      count: 1,
      value: ['Desc-B'],
      options: { singular: 'Category', plural: 'Categories' },
    });

    // Cleanup
    await dashboard.grid.column.delete({ title: 'Category' });
    await dashboard.treeView.deleteTable({ title: 'Products' });
    await dashboard.treeView.deleteTable({ title: 'Categories' });
  });
});
