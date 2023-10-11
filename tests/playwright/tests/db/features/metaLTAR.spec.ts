/*
 *
 * Meta bases, additional provision for deleting of rows, columns and tables with Link to another record field type
 *
 * Pre-requisite:
 *    TableA <hm> TableB <hm> TableC
 *    TableA <mm> TableD <mm> TableE
 *    TableA <hm> TableA : self relation
 *    TableA <mm> TableA : self relation
 * Insert some records in TableA, TableB, TableC, TableD, TableE, add some links between them
 *
 *
 * Tests:
 *   1. Delete a row from TableA : Verify record status in adjacent tables
 *   2. Delete hm link from TableA to TableB : Verify record status in adjacent tables
 *   3. Delete mm link from TableA to TableD : Verify record status in adjacent tables
 *   4. Delete a self link column from TableA : Verify
 *   5. Delete TableA : Verify record status in adjacent tables
 *
 */

import { test } from '@playwright/test';
import setup, { unsetup } from '../../../setup';
import { Api, UITypes } from 'nocodb-sdk';
import { DashboardPage } from '../../../pages/Dashboard';
import { GridPage } from '../../../pages/Dashboard/Grid';
import { createXcdb, deleteXcdb } from '../../../setup/xcdbProject';

let api: Api<any>;
const recordCount = 10;

// serial as all bases end up creating xcdb using same name
// fix me : use worker ID logic for creating unique base name
test.describe.serial('Test table', () => {
  let context: any;
  let dashboard: DashboardPage;
  let grid: GridPage;
  const tables = [];

  test.afterEach(async () => {
    try {
      if (context) {
        await deleteXcdb(context);
      }
    } catch (e) {
      console.log(e);
    }

    // reset tables array
    tables.length = 0;
  });

  test.beforeEach(async ({ page }) => {
    context = await setup({ page, isEmptyProject: true });
    dashboard = new DashboardPage(page, context.base);
    grid = dashboard.grid;

    // create a new xcdb base
    await dashboard.rootPage.waitForTimeout(650);
    const xcdb = await createXcdb(context);
    await dashboard.rootPage.waitForTimeout(650);

    await dashboard.rootPage.reload();
    await dashboard.treeView.openProject({ title: 'xcdb', context });

    api = new Api({
      baseURL: `http://localhost:8080/`,
      headers: {
        'xc-auth': context.token,
      },
    });

    const columns = [
      {
        column_name: 'Id',
        title: 'Id',
        uidt: UITypes.ID,
      },
      {
        column_name: 'Title',
        title: 'Title',
        uidt: UITypes.SingleLineText,
        pv: true,
      },
    ];

    const rows = [];
    for (let i = 0; i < recordCount * 10; i++) {
      rows.push({
        Id: i + 1,
        Title: `${i + 1}`,
      });
    }

    for (let i = 0; i < 5; i++) {
      const table = await api.source.tableCreate(xcdb.id, xcdb.sources?.[0].id, {
        table_name: `Table${i}`,
        title: `Table${i}`,
        columns: columns,
      });
      tables.push(table);
      await api.dbTableRow.bulkCreate('noco', xcdb.id, tables[i].id, rows);
    }

    // Create links
    // TableA <hm> TableB <hm> TableC
    await api.dbTableColumn.create(tables[0].id, {
      uidt: UITypes.Links,
      title: `TableA:hm:TableB`,
      column_name: `TableA:hm:TableB`,
      parentId: tables[0].id,
      childId: tables[1].id,
      type: 'hm',
    });
    await api.dbTableColumn.create(tables[1].id, {
      uidt: UITypes.Links,
      title: `TableB:hm:TableC`,
      column_name: `TableB:hm:TableC`,
      parentId: tables[1].id,
      childId: tables[2].id,
      type: 'hm',
    });

    // TableA <mm> TableD <mm> TableE
    await api.dbTableColumn.create(tables[0].id, {
      uidt: UITypes.Links,
      title: `TableA:mm:TableD`,
      column_name: `TableA:mm:TableD`,
      parentId: tables[0].id,
      childId: tables[3].id,
      type: 'mm',
    });
    await api.dbTableColumn.create(tables[3].id, {
      uidt: UITypes.Links,
      title: `TableD:mm:TableE`,
      column_name: `TableD:mm:TableE`,
      parentId: tables[3].id,
      childId: tables[4].id,
      type: 'mm',
    });

    // TableA <hm> TableA : self relation
    await api.dbTableColumn.create(tables[0].id, {
      uidt: UITypes.Links,
      title: `TableA:hm:TableA`,
      column_name: `TableA:hm:TableA`,
      parentId: tables[0].id,
      childId: tables[0].id,
      type: 'hm',
    });

    // TableA <mm> TableA : self relation
    await api.dbTableColumn.create(tables[0].id, {
      uidt: UITypes.Links,
      title: `TableA:mm:TableA`,
      column_name: `TableA:mm:TableA`,
      parentId: tables[0].id,
      childId: tables[0].id,
      type: 'mm',
    });

    // Add links
    // TableA <hm> TableB <hm> TableC
    // Link every record in tableA to 3 records in tableB
    for (let i = 1; i <= recordCount; i++) {
      await api.dbTableRow.nestedAdd('noco', xcdb.id, tables[0].id, i, 'hm', 'TableA:hm:TableB', `${i * 3 - 2}`);
      await api.dbTableRow.nestedAdd('noco', xcdb.id, tables[0].id, i, 'hm', 'TableA:hm:TableB', `${i * 3 - 1}`);
      await api.dbTableRow.nestedAdd('noco', xcdb.id, tables[0].id, i, 'hm', 'TableA:hm:TableB', `${i * 3 - 0}`);
    }
    // Link every record in tableB to 3 records in tableC
    for (let i = 1; i <= recordCount; i++) {
      await api.dbTableRow.nestedAdd('noco', xcdb.id, tables[1].id, i, 'hm', 'TableB:hm:TableC', `${i * 3 - 2}`);
      await api.dbTableRow.nestedAdd('noco', xcdb.id, tables[1].id, i, 'hm', 'TableB:hm:TableC', `${i * 3 - 1}`);
      await api.dbTableRow.nestedAdd('noco', xcdb.id, tables[1].id, i, 'hm', 'TableB:hm:TableC', `${i * 3 - 0}`);
    }

    // TableA <mm> TableD <mm> TableE
    // Link every record in tableA to 5 records in tableD
    for (let i = 1; i <= recordCount; i++) {
      await api.dbTableRow.nestedAdd('noco', xcdb.id, tables[0].id, i, 'mm', 'TableA:mm:TableD', `${i}`);
      await api.dbTableRow.nestedAdd('noco', xcdb.id, tables[0].id, i, 'mm', 'TableA:mm:TableD', `${i + 1}`);
      await api.dbTableRow.nestedAdd('noco', xcdb.id, tables[0].id, i, 'mm', 'TableA:mm:TableD', `${i + 2}`);
      await api.dbTableRow.nestedAdd('noco', xcdb.id, tables[0].id, i, 'mm', 'TableA:mm:TableD', `${i + 3}`);
      await api.dbTableRow.nestedAdd('noco', xcdb.id, tables[0].id, i, 'mm', 'TableA:mm:TableD', `${i + 4}`);
    }
    // Link every record in tableD to 5 records in tableE
    for (let i = 1; i <= recordCount; i++) {
      await api.dbTableRow.nestedAdd('noco', xcdb.id, tables[3].id, i, 'mm', 'TableD:mm:TableE', `${i}`);
      await api.dbTableRow.nestedAdd('noco', xcdb.id, tables[3].id, i, 'mm', 'TableD:mm:TableE', `${i + 1}`);
      await api.dbTableRow.nestedAdd('noco', xcdb.id, tables[3].id, i, 'mm', 'TableD:mm:TableE', `${i + 2}`);
      await api.dbTableRow.nestedAdd('noco', xcdb.id, tables[3].id, i, 'mm', 'TableD:mm:TableE', `${i + 3}`);
      await api.dbTableRow.nestedAdd('noco', xcdb.id, tables[3].id, i, 'mm', 'TableD:mm:TableE', `${i + 4}`);
    }

    // TableA <hm> TableA : self relation
    // Link every record in tableA to 3 records in tableA
    for (let i = 1; i <= recordCount; i++) {
      await api.dbTableRow.nestedAdd('noco', xcdb.id, tables[0].id, i, 'hm', 'TableA:hm:TableA', `${i * 3 - 2}`);
      await api.dbTableRow.nestedAdd('noco', xcdb.id, tables[0].id, i, 'hm', 'TableA:hm:TableA', `${i * 3 - 1}`);
      await api.dbTableRow.nestedAdd('noco', xcdb.id, tables[0].id, i, 'hm', 'TableA:hm:TableA', `${i * 3 - 0}`);
    }

    // TableA <mm> TableA : self relation
    // Link every record in tableA to 5 records in tableA
    for (let i = 1; i <= recordCount; i++) {
      await api.dbTableRow.nestedAdd('noco', xcdb.id, tables[0].id, i, 'mm', 'TableA:mm:TableA', `${i}`);
      await api.dbTableRow.nestedAdd('noco', xcdb.id, tables[0].id, i, 'mm', 'TableA:mm:TableA', `${i + 1}`);
      await api.dbTableRow.nestedAdd('noco', xcdb.id, tables[0].id, i, 'mm', 'TableA:mm:TableA', `${i + 2}`);
      await api.dbTableRow.nestedAdd('noco', xcdb.id, tables[0].id, i, 'mm', 'TableA:mm:TableA', `${i + 3}`);
      await api.dbTableRow.nestedAdd('noco', xcdb.id, tables[0].id, i, 'mm', 'TableA:mm:TableA', `${i + 4}`);
    }

    // refresh page
    await page.reload();
  });

  test.afterEach(async () => {
    await unsetup(context);
  });

  test('Delete record - single, over UI', async () => {
    await dashboard.treeView.openProject({ title: 'xcdb', context });
    await dashboard.treeView.openTable({ title: 'Table0' });
    await grid.deleteRow(0);

    // verify row count
    await dashboard.grid.verifyTotalRowCount({ count: 99 });

    // verify row count in all tables
    for (let i = 1; i <= 4; i++) {
      await dashboard.treeView.openTable({ title: `Table${i}` });
      await dashboard.grid.verifyTotalRowCount({ count: 100 });
    }

    // has-many removal verification
    await dashboard.treeView.openTable({ title: 'Table1' });
    await dashboard.grid.cell.verifyVirtualCell({ index: 0, columnHeader: 'Table0', count: 0, value: [], type: 'bt' });
    await dashboard.grid.cell.verifyVirtualCell({ index: 1, columnHeader: 'Table0', count: 0, value: [], type: 'bt' });
    await dashboard.grid.cell.verifyVirtualCell({ index: 2, columnHeader: 'Table0', count: 0, value: [], type: 'bt' });

    // many-many removal verification
    await dashboard.treeView.openTable({ title: 'Table3' });
    const params = {
      index: 0,
      columnHeader: 'Table0s',
      count: 0,
      value: [],
      type: 'hm',
      options: { singular: 'Table0', plural: 'Table0s' },
    };
    await dashboard.grid.cell.verifyVirtualCell({ ...params });
    await dashboard.grid.cell.verifyVirtualCell({ ...params, count: 1, index: 1, value: ['2'] });
    await dashboard.grid.cell.verifyVirtualCell({ ...params, count: 2, index: 2, value: ['2', '3'] });
    await dashboard.grid.cell.verifyVirtualCell({ ...params, count: 3, index: 3, value: ['2', '3', '4'] });
    await dashboard.grid.cell.verifyVirtualCell({ ...params, count: 4, index: 4, value: ['2', '3', '4', '5'] });
  });

  test('Delete record - bulk, over UI', async () => {
    await dashboard.treeView.openTable({ title: 'Table0' });
    await grid.selectRow(0);
    await grid.selectRow(1);
    await grid.selectRow(2);
    await grid.deleteSelectedRows();

    // verify row count
    await dashboard.grid.verifyTotalRowCount({ count: 97 });

    // verify row count in all tables
    for (let i = 1; i <= 4; i++) {
      await dashboard.treeView.openTable({ title: `Table${i}` });
      await dashboard.grid.verifyTotalRowCount({ count: 100 });
    }
  });

  test('Delete column', async () => {
    // has-many
    await dashboard.treeView.openTable({ title: 'Table0' });
    await dashboard.grid.column.delete({ title: 'TableA:hm:TableB' });

    // verify
    await dashboard.treeView.openTable({ title: 'Table1' });
    await dashboard.grid.column.verify({ title: 'Table0', isVisible: false });
    await dashboard.grid.column.verify({ title: 'TableB:hm:TableC', isVisible: true });

    ///////////////////////////////////////////////////////////////////////////////////////////////

    // many-many
    await dashboard.treeView.openTable({ title: 'Table0' });
    await dashboard.grid.column.delete({ title: 'TableA:mm:TableD' });

    // verify
    await dashboard.treeView.openTable({ title: 'Table3' });
    await dashboard.grid.column.verify({ title: 'Table0s', isVisible: false });
    await dashboard.grid.column.verify({ title: 'TableD:mm:TableE', isVisible: true });

    ///////////////////////////////////////////////////////////////////////////////////////////////

    // has-many self relation
    await dashboard.treeView.openTable({ title: 'Table0' });
    await dashboard.grid.column.delete({ title: 'TableA:hm:TableA' });

    // verify
    await dashboard.grid.column.verify({ title: 'TableA:hm:TableA', isVisible: false });
    await dashboard.grid.column.verify({ title: 'Table0', isVisible: false });

    ///////////////////////////////////////////////////////////////////////////////////////////////

    // many-many self relation
    await dashboard.treeView.openTable({ title: 'Table0' });
    await dashboard.grid.column.delete({ title: 'TableA:mm:TableA' });

    // verify
    await dashboard.grid.column.verify({ title: 'Table0s', isVisible: false });
    await dashboard.grid.column.verify({ title: 'TableA:mm:TableA', isVisible: false });
  });

  test('Delete table', async () => {
    await dashboard.treeView.deleteTable({ title: 'Table0' });
    await dashboard.treeView.verifyTable({ title: 'Table0', exists: false });

    // verify
    await dashboard.treeView.openTable({ title: 'Table1' });
    await dashboard.grid.column.verify({ title: 'Table0', isVisible: false });

    await dashboard.treeView.openTable({ title: 'Table3' });
    await dashboard.grid.column.verify({ title: 'Table0s', isVisible: false });
  });
});
