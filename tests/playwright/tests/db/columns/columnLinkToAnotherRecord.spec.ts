import { test } from '@playwright/test';
import { DashboardPage } from '../../../pages/Dashboard';
import setup, { unsetup } from '../../../setup';
import { enableQuickRun } from '../../../setup/db';

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

    await dashboard.treeView.openTable({ title: 'Sheet1' });
    await dashboard.grid.addNewRow({ index: 0, value: '1a' });
    await dashboard.grid.addNewRow({ index: 1, value: '1b' });
    await dashboard.grid.addNewRow({ index: 2, value: '1c' });

    // Create LTAR-HM column
    await dashboard.grid.column.create({
      title: 'Link1-2hm',
      type: 'Links',
      childTable: 'Sheet2',
      relationType: 'Has Many',
    });
    await dashboard.grid.column.create({
      title: 'Link1-2mm',
      type: 'Links',
      childTable: 'Sheet2',
      relationType: 'Many To many',
    });
    await dashboard.closeTab({ title: 'Sheet1' });

    await dashboard.treeView.openTable({ title: 'Sheet2', networkResponse: false });
    await dashboard.grid.column.create({
      title: 'Link2-1hm',
      type: 'Links',
      childTable: 'Sheet1',
      relationType: 'Has Many',
    });

    // Sheet2 now has all 3 column categories : HM, BT, MM
    //

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
      columnTitle: 'Link2-1hm',
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
      columnHeader: 'Link2-1hm',
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
      columnTitle: 'Link2-1hm',
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
      [['1 Sheet1'], ['1 Sheet1'], ['1 Sheet1']],
      [['1 Sheet1'], ['1 Sheet1'], ['1 Sheet1']],
    ];
    const colHeaders = ['Sheet1', 'Sheet1s', 'Link2-1hm'];

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

    await dashboard.closeTab({ title: 'Sheet2' });
    await dashboard.treeView.openTable({ title: 'Sheet1' });

    const expected2 = [
      [['1 Sheet2'], ['1 Sheet2'], ['1 Sheet2']],
      [['1 Sheet2'], ['1 Sheet2'], ['1 Sheet2']],
      [['2a'], ['2b'], ['2c']],
    ];
    const colHeaders2 = ['Link1-2hm', 'Link1-2mm', 'Sheet2'];

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
    await dashboard.grid.column.delete({ title: 'Link1-2hm' });
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
    await dashboard.treeView.openTable({ title: 'Country' });
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
