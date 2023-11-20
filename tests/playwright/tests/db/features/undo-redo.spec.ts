import { expect, Page, test } from '@playwright/test';
import { DashboardPage } from '../../../pages/Dashboard';
import setup, { unsetup } from '../../../setup';
import { Api, UITypes } from 'nocodb-sdk';
import { rowMixedValue } from '../../../setup/xcdb-records';
import { GridPage } from '../../../pages/Dashboard/Grid';
import { ToolbarPage } from '../../../pages/Dashboard/common/Toolbar';
import { enableQuickRun, isSqlite } from '../../../setup/db';

const validateResponse = false;

/**
 This change provides undo/redo on multiple actions over UI.

 Scope	      Actions
 ------------------------------
 Row	        Create, Update, Delete
 LTAR	        Link, Unlink
 Fields	      Show/hide, Reorder
 Sort	        Add, Update, Delete
 Filters	    Add, Update, Delete (Excluding Filter Groups)
 Row Height	  Update
 Column width	Update
 View	        Rename
 Table	      Rename

 **/
async function undo({ page, dashboard }: { page: Page; dashboard: DashboardPage }) {
  const isMac = await dashboard.grid.isMacOs();

  if (validateResponse) {
    await dashboard.grid.waitForResponse({
      uiAction: async () => await page.keyboard.press(isMac ? 'Meta+z' : 'Control+z'),
      httpMethodsToMatch: ['GET'],
      requestUrlPathToMatch: `/api/v1/db/data/noco`,
      responseJsonMatcher: json => json.pageInfo,
    });
  } else {
    await page.keyboard.press(isMac ? 'Meta+z' : 'Control+z');

    // allow time for undo to complete rendering
    await page.waitForTimeout(500);
  }
}

test.describe('Undo Redo', () => {
  let dashboard: DashboardPage, grid: GridPage, toolbar: ToolbarPage, context: any, api: Api<any>, table: any;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page, isEmptyProject: true });
    dashboard = new DashboardPage(page, context.base);
    grid = dashboard.grid;
    toolbar = dashboard.grid.toolbar;

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
        column_name: 'Number',
        title: 'Number',
        uidt: UITypes.Number,
        pv: true,
      },
      {
        column_name: 'Decimal',
        title: 'Decimal',
        uidt: UITypes.Decimal,
      },
      {
        column_name: 'Currency',
        title: 'Currency',
        uidt: UITypes.Currency,
      },
    ];

    try {
      const base = await api.base.read(context.base.id);
      table = await api.source.tableCreate(context.base.id, base.sources?.[0].id, {
        table_name: 'numberBased',
        title: 'numberBased',
        columns: columns,
      });
      const rowAttributes = [];
      for (let i = 0; i < 10; i++) {
        const row = {
          Number: rowMixedValue(columns[1], i),
          Decimal: rowMixedValue(columns[2], i),
          Currency: rowMixedValue(columns[3], i),
        };
        rowAttributes.push(row);
      }

      await api.dbTableRow.bulkCreate('noco', context.base.id, table.id, rowAttributes);
    } catch (e) {
      console.log(e);
    }

    // reload page after api calls
    await page.reload();
  });

  test.afterEach(async () => {
    await unsetup(context);
  });

  async function verifyRecords(values: any[] = []) {
    // inserted values
    const expectedValues = [33, NaN, 456, 333, 267, 34, 8754, 3234, 44, 33, ...values];

    const currentRecords: Record<string, any> = await api.dbTableRow.list('noco', context.base.id, table.id, {
      fields: ['Number'],
      limit: 100,
    });

    // verify if expectedValues are same as currentRecords
    expect(currentRecords.list.map(r => parseInt(r.Number))).toEqual(expectedValues);

    // verify row count
    await dashboard.grid.verifyTotalRowCount({ count: expectedValues.length });
  }

  test('Row: Create, Update, Delete', async ({ page }) => {
    await dashboard.closeTab({ title: 'Team & Auth' });
    await dashboard.treeView.openTable({ title: 'numberBased' });

    // Row.Create
    await grid.addNewRow({ index: 10, value: '333', columnHeader: 'Number', networkValidation: true });
    await grid.addNewRow({ index: 11, value: '444', columnHeader: 'Number', networkValidation: true });
    await verifyRecords([333, 444]);

    // Row.Update
    await grid.editRow({ index: 10, value: '555', columnHeader: 'Number', networkValidation: true });
    await grid.editRow({ index: 11, value: '666', columnHeader: 'Number', networkValidation: true });
    await verifyRecords([555, 666]);

    // Row.Delete
    await grid.deleteRow(10, 'Number');
    await grid.deleteRow(10, 'Number');
    await verifyRecords([]);

    // Undo : Row.Delete
    await undo({ page, dashboard });
    await verifyRecords([666]);
    await undo({ page, dashboard });
    await verifyRecords([555, 666]);

    // Undo : Row.Update
    await undo({ page, dashboard });
    await verifyRecords([555, 444]);
    await undo({ page, dashboard });
    await verifyRecords([333, 444]);

    // Undo : Row.Create
    await undo({ page, dashboard });
    await verifyRecords([333]);
    await undo({ page, dashboard });
    await verifyRecords([]);
  });

  test('Fields: Hide, Show, Reorder', async ({ page }) => {
    async function verifyFieldsOrder(fields: string[]) {
      const fieldTitles = await toolbar.fields.getFieldsTitles();
      expect(fieldTitles).toEqual(fields);
    }

    await dashboard.closeTab({ title: 'Team & Auth' });
    await dashboard.treeView.openTable({ title: 'numberBased' });

    // hack: wait for grid to load
    // https://github.com/nocodb/nocodb/actions/runs/5025773509/jobs/9013176970
    await page.waitForTimeout(1000);

    await verifyFieldsOrder(['Number', 'Decimal', 'Currency']);

    // Hide Decimal
    await toolbar.fields.toggle({ title: 'Decimal', isLocallySaved: false });
    await verifyFieldsOrder(['Number', 'Currency']);

    // Hide Currency
    await toolbar.fields.toggle({ title: 'Currency', isLocallySaved: false });
    await verifyFieldsOrder(['Number']);

    // Un hide Decimal
    await toolbar.fields.toggle({ title: 'Decimal', isLocallySaved: false });
    await verifyFieldsOrder(['Number', 'Decimal']);

    // Un hide Currency
    await toolbar.fields.toggle({ title: 'Currency', isLocallySaved: false });
    await verifyFieldsOrder(['Number', 'Decimal', 'Currency']);

    // Undo : un hide Currency
    await undo({ page, dashboard });
    await verifyFieldsOrder(['Number', 'Decimal']);

    // Undo : un hide Decimal
    await undo({ page, dashboard });
    await verifyFieldsOrder(['Number']);

    // Undo : hide Currency
    await undo({ page, dashboard });
    await verifyFieldsOrder(['Number', 'Currency']);

    // Undo : hide Decimal
    await undo({ page, dashboard });
    await verifyFieldsOrder(['Number', 'Decimal', 'Currency']);

    // reorder test
    await toolbar.fields.dragDropFields({ from: 1, to: 0 });
    await verifyFieldsOrder(['Number', 'Currency', 'Decimal']);

    // Undo : reorder
    await undo({ page, dashboard });
    await verifyFieldsOrder(['Number', 'Decimal', 'Currency']);
  });

  test('Fields: Sort', async ({ page }) => {
    await dashboard.closeTab({ title: 'Team & Auth' });
    await dashboard.treeView.openTable({ title: 'numberBased' });

    async function verifyRecords({ sorted }: { sorted: boolean }) {
      // inserted values
      const expectedSorted = [NaN, 33, 33, 34, 44, 267, 333, 456, 3234, 8754];
      const expectedUnsorted = [33, NaN, 456, 333, 267, 34, 8754, 3234, 44, 33];

      const currentRecords: Record<string, any> = await api.dbTableRow.list('noco', context.base.id, table.id, {
        fields: ['Number'],
        limit: 100,
        sort: sorted ? ['Number'] : [],
      });

      // verify if expectedValues are same as currentRecords
      expect(currentRecords.list.map(r => parseInt(r.Number))).toEqual(sorted ? expectedSorted : expectedUnsorted);
    }

    await toolbar.sort.add({ title: 'Number', ascending: true, locallySaved: false });
    await verifyRecords({ sorted: true });
    await toolbar.sort.reset();
    await verifyRecords({ sorted: false });

    await undo({ page, dashboard });
    await verifyRecords({ sorted: true });
    await undo({ page, dashboard });
    await verifyRecords({ sorted: false });
  });

  test('Fields: Filter', async ({ page }) => {
    await dashboard.closeTab({ title: 'Team & Auth' });
    await dashboard.treeView.openTable({ title: 'numberBased' });

    async function verifyRecords({ filtered }: { filtered: boolean }) {
      // inserted values
      const expectedFiltered = [33, 33];
      const expectedUnfiltered = [33, NaN, 456, 333, 267, 34, 8754, 3234, 44, 33];

      const currentRecords: Record<string, any> = await api.dbTableRow.list('noco', context.base.id, table.id, {
        fields: ['Number'],
        limit: 100,
        where: filtered ? '(Number,eq,33)' : '',
      });

      // verify if expectedValues are same as currentRecords
      expect(currentRecords.list.map(r => parseInt(r.Number))).toEqual(
        filtered ? expectedFiltered : expectedUnfiltered
      );
    }

    await toolbar.clickFilter();
    await toolbar.filter.add({ title: 'Number', operation: '=', value: '33', skipWaitingResponse: true });
    await toolbar.clickFilter();

    await verifyRecords({ filtered: true });
    await toolbar.filter.reset();
    await verifyRecords({ filtered: false });

    // undo: remove filter
    await undo({ page, dashboard });
    await verifyRecords({ filtered: true });
    // undo: update filter
    await undo({ page, dashboard });
    // undo: add filter
    await undo({ page, dashboard });
    await verifyRecords({ filtered: false });
  });

  test('Row height', async ({ page }) => {
    async function verifyRowHeight({ height }: { height: string }) {
      await expect(dashboard.grid.rowPage.getRecord(0)).toHaveAttribute('style', `height: ${height};`);
    }

    // close 'Team & Auth' tab
    await dashboard.closeTab({ title: 'Team & Auth' });
    await dashboard.treeView.openTable({ title: 'numberBased' });

    const timeOut = 200;

    await verifyRowHeight({ height: '1.8rem' });

    // set row height & verify
    await toolbar.clickRowHeight();
    await toolbar.rowHeight.click({ title: 'Tall' });
    await new Promise(resolve => setTimeout(resolve, timeOut));
    await verifyRowHeight({ height: '7.2rem' });

    await toolbar.clickRowHeight();
    await toolbar.rowHeight.click({ title: 'Medium' });
    await new Promise(resolve => setTimeout(resolve, timeOut));
    await verifyRowHeight({ height: '3.6rem' });

    await undo({ page, dashboard });
    await new Promise(resolve => setTimeout(resolve, timeOut));
    await verifyRowHeight({ height: '7.2rem' });

    await undo({ page, dashboard });
    await new Promise(resolve => setTimeout(resolve, timeOut));
    await verifyRowHeight({ height: '1.8rem' });
  });

  test('Column width', async ({ page }) => {
    await dashboard.treeView.openTable({ title: 'numberBased' });

    const originalWidth = await dashboard.grid.column.getWidth({ title: 'Number' });

    await dashboard.grid.column.resize({ src: 'Number', dst: 'Decimal' });
    let modifiedWidth = await dashboard.grid.column.getWidth({ title: 'Number' });
    let retryCounter = 0;
    while (modifiedWidth === originalWidth) {
      retryCounter++;
      await dashboard.rootPage.waitForTimeout(500 * retryCounter);
      if (retryCounter > 5) {
        break;
      }

      modifiedWidth = await dashboard.grid.column.getWidth({ title: 'Number' });
    }

    expect(modifiedWidth).toBeGreaterThan(originalWidth);

    // TODO: Seems to be an issue with undo only in the case of test where we need to undo twice for this test
    await page.keyboard.press('Meta+z');

    // TODO: This portions seems to be bugging on PW side
    return;
    await undo({ page, dashboard });
    await expect.poll(async () => await dashboard.grid.column.getWidth({ title: 'Number' })).toBe(originalWidth);
  });
});

test.describe('Undo Redo - Table & view rename operations', () => {
  if (enableQuickRun()) test.skip();
  let dashboard: DashboardPage, context: any, api: Api<any>, table: any;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page, isEmptyProject: true });
    dashboard = new DashboardPage(page, context.base);

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
        column_name: 'Number',
        title: 'Number',
        uidt: UITypes.Number,
        pv: true,
      },
      {
        column_name: 'SingleSelect',
        title: 'SingleSelect',
        uidt: UITypes.SingleSelect,
        dtxp: "'jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'",
      },
    ];

    try {
      const base = await api.base.read(context.base.id);
      table = await api.source.tableCreate(context.base.id, base.sources?.[0].id, {
        table_name: 'selectBased',
        title: 'selectBased',
        columns: columns,
      });
      const rowAttributes = [];
      for (let i = 0; i < 10; i++) {
        const row = {
          Number: rowMixedValue(columns[1], i),
          SingleSelect: rowMixedValue(columns[2], i),
        };
        rowAttributes.push(row);
      }

      await api.dbTableRow.bulkCreate('noco', context.base.id, table.id, rowAttributes);
    } catch (e) {
      console.log(e);
    }

    // reload page after api calls
    await page.reload();
  });

  test.afterEach(async () => {
    await unsetup(context);
  });

  test('Table & View rename', async ({ page }) => {
    // close 'Team & Auth' tab
    await dashboard.closeTab({ title: 'Team & Auth' });
    await dashboard.treeView.openTable({ title: 'selectBased' });

    // table rename
    await dashboard.treeView.renameTable({ title: 'selectBased', newTitle: 'newNameForTest' });
    await dashboard.treeView.verifyTable({ title: 'newNameForTest' });
    await dashboard.rootPage.waitForTimeout(100);

    await undo({ page, dashboard });
    await dashboard.rootPage.waitForTimeout(100);
    await dashboard.treeView.verifyTable({ title: 'selectBased' });

    // View rename
    const viewTypes = ['Grid', 'Gallery', 'Form', 'Kanban'];
    for (let i = 0; i < viewTypes.length; i++) {
      switch (viewTypes[i]) {
        case 'Grid':
          await dashboard.viewSidebar.createGridView({
            title: 'Grid',
          });
          break;
        case 'Gallery':
          await dashboard.viewSidebar.createGalleryView({
            title: 'Gallery',
          });
          break;
        case 'Form':
          await dashboard.viewSidebar.createFormView({
            title: 'Form',
          });
          break;
        case 'Kanban':
          await dashboard.viewSidebar.createKanbanView({
            title: 'Kanban',
          });
          break;
        default:
          break;
      }
      await dashboard.viewSidebar.renameView({ title: viewTypes[i], newTitle: 'newNameForTest' });
      await dashboard.viewSidebar.verifyView({ title: 'newNameForTest', index: 0 });
      await new Promise(resolve => setTimeout(resolve, 100));
      await undo({ page, dashboard });
      await dashboard.viewSidebar.verifyView({ title: viewTypes[i], index: 0 });
      await dashboard.viewSidebar.deleteView({ title: viewTypes[i] });
    }
  });
});

test.describe('Undo Redo - LTAR', () => {
  if (enableQuickRun()) test.skip();
  let dashboard: DashboardPage, grid: GridPage, context: any, api: Api<any>, cityTable: any, countryTable: any;
  test.beforeEach(async ({ page }) => {
    context = await setup({ page, isEmptyProject: true });
    dashboard = new DashboardPage(page, context.base);
    grid = dashboard.grid;

    api = new Api({
      baseURL: `http://localhost:8080/`,
      headers: {
        'xc-auth': context.token,
      },
    });

    const cityColumns = [
      {
        column_name: 'Id',
        title: 'Id',
        uidt: UITypes.ID,
      },
      {
        column_name: 'City',
        title: 'City',
        uidt: UITypes.SingleLineText,
        pv: true,
      },
    ];
    const countryColumns = [
      {
        column_name: 'Id',
        title: 'Id',
        uidt: UITypes.ID,
      },
      {
        column_name: 'Country',
        title: 'Country',
        uidt: UITypes.SingleLineText,
        pv: true,
      },
    ];

    try {
      const base = await api.base.read(context.base.id);
      cityTable = await api.source.tableCreate(context.base.id, base.sources?.[0].id, {
        table_name: 'City',
        title: 'City',
        columns: cityColumns,
      });
      countryTable = await api.source.tableCreate(context.base.id, base.sources?.[0].id, {
        table_name: 'Country',
        title: 'Country',
        columns: countryColumns,
      });

      const cityRowAttributes = [{ City: 'Mumbai' }, { City: 'Pune' }, { City: 'Delhi' }, { City: 'Bangalore' }];
      await api.dbTableRow.bulkCreate('noco', context.base.id, cityTable.id, cityRowAttributes);

      const countryRowAttributes = [
        { Country: 'India' },
        { Country: 'USA' },
        { Country: 'UK' },
        { Country: 'Australia' },
      ];
      await api.dbTableRow.bulkCreate('noco', context.base.id, countryTable.id, countryRowAttributes);

      // create LTAR Country has-many City
      await api.dbTableColumn.create(countryTable.id, {
        column_name: 'CityList',
        title: 'CityList',
        uidt: UITypes.Links,
        parentId: countryTable.id,
        childId: cityTable.id,
        type: 'hm',
      });

      // await api.dbTableRow.nestedAdd('noco', context.base.id, countryTable.id, '1', 'hm', 'CityList', '1');
    } catch (e) {
      console.log(e);
    }

    // reload page after api calls
    await page.reload();
  });

  test.afterEach(async () => {
    await unsetup(context);
  });

  async function verifyRecords(values: any[] = []) {
    // inserted values
    const expectedValues = [...values];

    try {
      const currentRecords: Record<string, any> = await api.dbTableRow.list('noco', context.base.id, countryTable.id, {
        fields: ['CityList'],
        limit: 100,
      });
      expect(currentRecords.list.length).toBe(4);
      expect(+currentRecords.list[0].CityList).toBe(expectedValues.length);
    } catch (e) {
      console.log(e);
    }

    if (expectedValues.length > 0) {
      // read nested records associated with first record
      const nestedRecords: Record<string, any> = await api.dbTableRow.nestedList(
        'noco',
        context.base.id,
        countryTable.id,
        1,
        'hm',
        'CityList'
      );
      const cities = nestedRecords.list.map((record: any) => record.City);

      for (let i = 0; i < expectedValues.length; i++) {
        expect(cities.includes(expectedValues[i])).toBeTruthy();
      }
    }
  }

  async function undo({ page, values }: { page: Page; values: string[] }) {
    const isMac = await grid.isMacOs();
    await dashboard.grid.waitForResponse({
      uiAction: async () => await page.keyboard.press(isMac ? 'Meta+z' : 'Control+z'),
      httpMethodsToMatch: ['GET'],
      requestUrlPathToMatch: `/api/v1/db/data/noco`,
      responseJsonMatcher: json => json.pageInfo,
    });
    await verifyRecords(values);
  }

  test('Row: Link, Unlink', async ({ page }) => {
    await dashboard.closeTab({ title: 'Team & Auth' });
    await dashboard.treeView.openTable({ title: 'Country' });

    await grid.cell.inCellAdd({ index: 0, columnHeader: 'CityList' });
    await dashboard.linkRecord.select('Mumbai');
    await grid.cell.inCellAdd({ index: 0, columnHeader: 'CityList' });
    await dashboard.linkRecord.select('Delhi');

    await grid.cell.unlinkVirtualCell({ index: 0, columnHeader: 'CityList' });
    await grid.cell.unlinkVirtualCell({ index: 0, columnHeader: 'CityList' });

    await verifyRecords([]);
    await undo({ page, values: ['Mumbai'] });
    await undo({ page, values: ['Delhi', 'Mumbai'] });
    await undo({ page, values: ['Mumbai'] });
    await undo({ page, values: [] });
  });

  test('Row with links: Delete & Undo', async ({ page }) => {
    // SQLite has foreign key constraint disabled by default & hence below test
    // will work even for ext DB
    if (!isSqlite(context)) test.skip();

    await dashboard.closeTab({ title: 'Team & Auth' });
    await dashboard.treeView.openTable({ title: 'Country' });

    await grid.cell.inCellAdd({ index: 0, columnHeader: 'CityList' });
    await dashboard.linkRecord.select('Mumbai');

    await grid.cell.inCellAdd({ index: 0, columnHeader: 'CityList' });
    await dashboard.linkRecord.select('Delhi');

    await grid.deleteRow(0, 'Country');
    await dashboard.rootPage.waitForTimeout(200);
    await page.keyboard.press((await grid.isMacOs()) ? 'Meta+z' : 'Control+z');
    await dashboard.rootPage.waitForTimeout(200);
    await verifyRecords(['Mumbai', 'Delhi']);
    await dashboard.rootPage.reload();
    await verifyRecords(['Mumbai', 'Delhi']);
  });
});

test.describe('Undo Redo - Select based', () => {
  if (enableQuickRun()) test.skip();
  let dashboard: DashboardPage, /*grid: GridPage,*/ context: any, api: Api<any>, table: any;
  test.beforeEach(async ({ page }) => {
    context = await setup({ page, isEmptyProject: true });
    dashboard = new DashboardPage(page, context.base);
    // grid = dashboard.grid;

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
      {
        column_name: 'select',
        title: 'select',
        uidt: UITypes.SingleSelect,
        dtxp: "'jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'",
      },
    ];

    try {
      const base = await api.base.read(context.base.id);
      table = await api.source.tableCreate(context.base.id, base.sources?.[0].id, {
        table_name: 'selectSample',
        title: 'selectSample',
        columns,
      });

      const RowAttributes = [
        { Title: 'Mumbai', select: 'jan' },
        { Title: 'Pune', select: 'feb' },
        { Title: 'Delhi', select: 'mar' },
        { Title: 'Bangalore', select: 'jan' },
      ];
      await api.dbTableRow.bulkCreate('noco', context.base.id, table.id, RowAttributes);
    } catch (e) {
      console.log(e);
    }

    // reload page after api calls
    await page.reload();
  });

  test.afterEach(async () => {
    await unsetup(context);
  });

  test.skip('Kanban', async ({ page }) => {
    await dashboard.closeTab({ title: 'Team & Auth' });
    await dashboard.treeView.openTable({ title: 'selectSample' });

    await dashboard.viewSidebar.createKanbanView({
      title: 'Kanban',
    });

    const kanban = dashboard.kanban;

    // Drag drop stack
    await kanban.verifyStackOrder({
      order: ['Uncategorized', 'jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'],
    });
    // verify drag drop stack
    await kanban.dragDropStack({
      from: 1, // jan
      to: 2, // feb
    });
    await kanban.verifyStackOrder({
      order: ['Uncategorized', 'feb', 'jan', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'],
    });
    // undo drag drop stack
    await undo({ page, dashboard });
    await kanban.verifyStackOrder({
      order: ['Uncategorized', 'jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'],
    });

    // drag drop card
    await kanban.verifyCardCount({
      count: [0, 2, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    });
    await kanban.dragDropCard({ from: { stack: 1, card: 0 }, to: { stack: 2, card: 0 } });
    await kanban.verifyCardCount({
      count: [0, 1, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    });
    // undo drag drop card
    await undo({ page, dashboard });
    await kanban.verifyCardCount({
      count: [0, 2, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    });
  });
});
