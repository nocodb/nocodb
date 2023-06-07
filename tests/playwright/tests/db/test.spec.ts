/*
 *
 * Meta projects, additional provision for deleting of rows, columns and tables with Link to another record field type
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
import setup from '../../setup';
import { Api, UITypes } from 'nocodb-sdk';
import { DashboardPage } from '../../pages/Dashboard';
import { GridPage } from '../../pages/Dashboard/Grid';
import { createXcdb, deleteXcdb } from '../../setup/xcdb';
import { ProjectsPage } from '../../pages/ProjectsPage';
import { isSqlite } from '../../setup/db';
let api: Api<any>;
const recordCount = 10;

test.describe.only('Test table', () => {
  let context: any;
  let dashboard: DashboardPage;
  let grid: GridPage;
  const tables = [];

  test.afterEach(async () => {
    try {
      if (context) {
        await deleteXcdb(context.token);
      }
    } catch (e) {
      console.log(e);
    }

    // reset tables array
    tables.length = 0;
  });

  test.beforeEach(async ({ page }) => {
    context = await setup({ page, isEmptyProject: true });
    dashboard = new DashboardPage(page, context.project);
    grid = dashboard.grid;

    // create a new xcdb project
    const xcdb = await createXcdb(context.token);
    await dashboard.clickHome();
    const projectsPage = new ProjectsPage(dashboard.rootPage);
    await projectsPage.openProject({ title: 'xcdb', withoutPrefix: true });

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

    // Create tables
    // const project = await api.project.read(xcdb.id);

    for (let i = 0; i < 5; i++) {
      const table = await api.base.tableCreate(xcdb.id, xcdb.bases?.[0].id, {
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
      uidt: UITypes.LinkToAnotherRecord,
      title: `TableA:hm:TableB`,
      column_name: `TableA:hm:TableB`,
      parentId: tables[0].id,
      childId: tables[1].id,
      type: 'hm',
    });

    // refresh page
    await page.reload();
  });

  test('Delete record - single, over UI', async () => {
    if (isSqlite(context)) {
      return;
    }
  });

  test('Delete record - bulk, over UI', async () => {
    if (isSqlite(context)) {
      return;
    }
  });

  test('Delete column', async () => {
    if (isSqlite(context)) {
      return;
    }
  });

  test('Delete table', async () => {
    if (isSqlite(context)) {
      return;
    }
  });
});
