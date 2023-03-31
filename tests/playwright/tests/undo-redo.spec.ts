import { expect, Page, test } from '@playwright/test';
import { DashboardPage } from '../pages/Dashboard';
import setup from '../setup';
import { Api, UITypes } from 'nocodb-sdk';
import { rowMixedValue } from '../setup/xcdb-records';
import { GridPage } from '../pages/Dashboard/Grid';
import { ToolbarPage } from '../pages/Dashboard/common/Toolbar';

let dashboard: DashboardPage,
  grid: GridPage,
  toolbar: ToolbarPage,
  context: any,
  api: Api<any>,
  records: Record<string, any>,
  table: any,
  cityTable: any,
  countryTable: any;

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
async function undo({ page }: { page: Page }) {
  const isMac = await grid.isMacOs();

  if (validateResponse) {
    await dashboard.grid.waitForResponse({
      uiAction: () => page.keyboard.press(isMac ? 'Meta+z' : 'Control+z'),
      httpMethodsToMatch: ['GET'],
      requestUrlPathToMatch: `/api/v1/db/data/noco/`,
      responseJsonMatcher: json => json.pageInfo,
    });
  } else {
    await page.keyboard.press(isMac ? 'Meta+z' : 'Control+z');
    await page.waitForTimeout(100);
  }
}

test.describe('Undo Redo', () => {
  test.beforeEach(async ({ page }) => {
    context = await setup({ page, isEmptyProject: true });
    dashboard = new DashboardPage(page, context.project);
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
      const project = await api.project.read(context.project.id);
      table = await api.base.tableCreate(context.project.id, project.bases?.[0].id, {
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

      await api.dbTableRow.bulkCreate('noco', context.project.id, table.id, rowAttributes);
      records = await api.dbTableRow.list('noco', context.project.id, table.id, { limit: 100 });
    } catch (e) {
      console.log(e);
    }

    // reload page after api calls
    await page.reload();
  });

  async function verifyRecords(values: any[] = []) {
    // inserted values
    const expectedValues = [33, NaN, 456, 333, 267, 34, 8754, 3234, 44, 33, ...values];

    const currentRecords: Record<string, any> = await api.dbTableRow.list('noco', context.project.id, table.id, {
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
    await undo({ page });
    await verifyRecords([666]);
    await undo({ page });
    await verifyRecords([555, 666]);

    // Undo : Row.Update
    await undo({ page });
    await verifyRecords([555, 444]);
    await undo({ page });
    await verifyRecords([333, 444]);

    // Undo : Row.Create
    await undo({ page });
    await verifyRecords([333]);
    await undo({ page });
    await verifyRecords([]);
  });

  test('Fields: Hide, Show, Reorder', async ({ page }) => {
    async function verifyFieldsOrder(fields: string[]) {
      const fieldTitles = await toolbar.fields.getFieldsTitles();
      expect(fieldTitles).toEqual(fields);
    }

    await dashboard.closeTab({ title: 'Team & Auth' });
    await dashboard.treeView.openTable({ title: 'numberBased' });

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
    await undo({ page });
    await verifyFieldsOrder(['Number', 'Decimal']);

    // Undo : un hide Decimal
    await undo({ page });
    await verifyFieldsOrder(['Number']);

    // Undo : hide Currency
    await undo({ page });
    await verifyFieldsOrder(['Number', 'Currency']);

    // Undo : hide Decimal
    await undo({ page });
    await verifyFieldsOrder(['Number', 'Decimal', 'Currency']);

    // reorder test
    await toolbar.fields.dragDropFields({ from: 1, to: 0 });
    await verifyFieldsOrder(['Number', 'Currency', 'Decimal']);

    // Undo : reorder
    await undo({ page });
    await verifyFieldsOrder(['Number', 'Decimal', 'Currency']);
  });

  test('Fields: Sort', async ({ page }) => {
    await dashboard.closeTab({ title: 'Team & Auth' });
    await dashboard.treeView.openTable({ title: 'numberBased' });

    async function verifyRecords({ sorted }: { sorted: boolean }) {
      // inserted values
      const expectedSorted = [NaN, 33, 33, 34, 44, 267, 333, 456, 3234, 8754];
      const expectedUnsorted = [33, NaN, 456, 333, 267, 34, 8754, 3234, 44, 33];

      const currentRecords: Record<string, any> = await api.dbTableRow.list('noco', context.project.id, table.id, {
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

    await undo({ page });
    await verifyRecords({ sorted: true });
    await undo({ page });
    await verifyRecords({ sorted: false });
  });

  test('Fields: Filter', async ({ page }) => {
    await dashboard.closeTab({ title: 'Team & Auth' });
    await dashboard.treeView.openTable({ title: 'numberBased' });

    async function verifyRecords({ filtered }: { filtered: boolean }) {
      // inserted values
      const expectedFiltered = [33, 33];
      const expectedUnfiltered = [33, NaN, 456, 333, 267, 34, 8754, 3234, 44, 33];

      const currentRecords: Record<string, any> = await api.dbTableRow.list('noco', context.project.id, table.id, {
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
    await toolbar.filter.add({ title: 'Number', operation: '=', value: '33' });
    await toolbar.clickFilter();

    await verifyRecords({ filtered: true });
    await toolbar.filter.reset();
    await verifyRecords({ filtered: false });

    await undo({ page });
    await verifyRecords({ filtered: true });
    await undo({ page });
    await verifyRecords({ filtered: false });
  });

  test('Row height', async ({ page }) => {
    async function verifyRowHeight({ height }: { height: string }) {
      await dashboard.grid.rowPage.getRecordHeight(0).then(readValue => {
        expect(readValue).toBe(height);
      });
    }

    // close 'Team & Auth' tab
    await dashboard.closeTab({ title: 'Team & Auth' });
    await dashboard.treeView.openTable({ title: 'numberBased' });

    const timeOut = 200;

    await verifyRowHeight({ height: '1.5rem' });

    // set row height & verify
    await toolbar.clickRowHeight();
    await toolbar.rowHeight.click({ title: 'Tall' });
    await new Promise(resolve => setTimeout(resolve, timeOut));
    await verifyRowHeight({ height: '6rem' });

    await toolbar.clickRowHeight();
    await toolbar.rowHeight.click({ title: 'Medium' });
    await new Promise(resolve => setTimeout(resolve, timeOut));
    await verifyRowHeight({ height: '3rem' });

    await undo({ page });
    await new Promise(resolve => setTimeout(resolve, timeOut));
    await verifyRowHeight({ height: '6rem' });

    await undo({ page });
    await new Promise(resolve => setTimeout(resolve, timeOut));
    await verifyRowHeight({ height: '1.5rem' });
  });

  test('Column width', async ({ page }) => {
    // close 'Team & Auth' tab
    await dashboard.closeTab({ title: 'Team & Auth' });
    await dashboard.treeView.openTable({ title: 'numberBased' });

    const originalWidth = await dashboard.grid.column.getWidth({ title: 'Number' });

    await dashboard.grid.column.resize({ src: 'Number', dst: 'Decimal' });
    await dashboard.rootPage.waitForTimeout(100);

    const modifiedWidth = await dashboard.grid.column.getWidth({ title: 'Number' });
    expect(modifiedWidth).toBeGreaterThan(originalWidth);

    await undo({ page });
    expect(await dashboard.grid.column.getWidth({ title: 'Number' })).toBe(originalWidth);
  });
});

test.describe('Undo Redo - Table & view rename operations', () => {
  test.beforeEach(async ({ page }) => {
    context = await setup({ page, isEmptyProject: true });
    dashboard = new DashboardPage(page, context.project);
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
        column_name: 'SingleSelect',
        title: 'SingleSelect',
        uidt: UITypes.SingleSelect,
        dtxp: "'jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'",
      },
    ];

    try {
      const project = await api.project.read(context.project.id);
      table = await api.base.tableCreate(context.project.id, project.bases?.[0].id, {
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

      await api.dbTableRow.bulkCreate('noco', context.project.id, table.id, rowAttributes);
      records = await api.dbTableRow.list('noco', context.project.id, table.id, { limit: 100 });
    } catch (e) {
      console.log(e);
    }

    // reload page after api calls
    await page.reload();
  });

  test('Table & View rename', async ({ page }) => {
    // close 'Team & Auth' tab
    await dashboard.closeTab({ title: 'Team & Auth' });
    await dashboard.treeView.openTable({ title: 'selectBased' });

    // table rename
    await dashboard.treeView.renameTable({ title: 'selectBased', newTitle: 'newNameForTest' });
    await dashboard.treeView.verifyTable({ title: 'newNameForTest' });
    await dashboard.rootPage.waitForTimeout(100);

    await undo({ page });
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
      await dashboard.viewSidebar.verifyView({ title: 'newNameForTest', index: 1 });
      await new Promise(resolve => setTimeout(resolve, 100));
      await undo({ page });
      await dashboard.viewSidebar.verifyView({ title: viewTypes[i], index: 1 });
      await dashboard.viewSidebar.deleteView({ title: viewTypes[i] });
    }
  });
});

test.describe('Undo Redo - LTAR', () => {
  test.beforeEach(async ({ page }) => {
    context = await setup({ page, isEmptyProject: true });
    dashboard = new DashboardPage(page, context.project);
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
      const project = await api.project.read(context.project.id);
      cityTable = await api.base.tableCreate(context.project.id, project.bases?.[0].id, {
        table_name: 'City',
        title: 'City',
        columns: cityColumns,
      });
      countryTable = await api.base.tableCreate(context.project.id, project.bases?.[0].id, {
        table_name: 'Country',
        title: 'Country',
        columns: countryColumns,
      });

      const cityRowAttributes = [{ City: 'Mumbai' }, { City: 'Pune' }, { City: 'Delhi' }, { City: 'Bangalore' }];
      await api.dbTableRow.bulkCreate('noco', context.project.id, cityTable.id, cityRowAttributes);

      const countryRowAttributes = [
        { Country: 'India' },
        { Country: 'USA' },
        { Country: 'UK' },
        { Country: 'Australia' },
      ];
      await api.dbTableRow.bulkCreate('noco', context.project.id, countryTable.id, countryRowAttributes);

      // create LTAR Country has-many City
      await api.dbTableColumn.create(countryTable.id, {
        column_name: 'CityList',
        title: 'CityList',
        uidt: UITypes.LinkToAnotherRecord,
        parentId: countryTable.id,
        childId: cityTable.id,
        type: 'hm',
      });

      // await api.dbTableRow.nestedAdd('noco', context.project.id, countryTable.id, '1', 'hm', 'CityList', '1');
    } catch (e) {
      console.log(e);
    }

    // reload page after api calls
    await page.reload();
  });

  async function verifyRecords(values: any[] = []) {
    // inserted values
    const expectedValues = [...values];

    const currentRecords: Record<string, any> = await api.dbTableRow.list('noco', context.project.id, countryTable.id, {
      fields: ['CityList'],
      limit: 100,
    });

    // verify if expectedValues array includes all the values in currentRecords
    // currentRecords [ { Id: 1, City: 'Mumbai' }, { Id: 3, City: 'Delhi' } ]
    // expectedValues [ 'Mumbai', 'Delhi' ]
    currentRecords.list[0].CityList.forEach((record: any) => {
      expect(expectedValues).toContain(record.City);
    });
    expect(currentRecords.list[0].CityList.length).toBe(expectedValues.length);
  }

  async function undo({ page, values }: { page: Page; values: string[] }) {
    const isMac = await grid.isMacOs();
    await dashboard.grid.waitForResponse({
      uiAction: () => page.keyboard.press(isMac ? 'Meta+z' : 'Control+z'),
      httpMethodsToMatch: ['GET'],
      requestUrlPathToMatch: `/api/v1/db/data/noco/`,
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
    await undo({ page, values: ['Delhi'] });
    await undo({ page, values: ['Mumbai', 'Delhi'] });
    await undo({ page, values: ['Mumbai'] });
    await undo({ page, values: [] });
  });
});

test.describe('Undo Redo - Select based', () => {
  test.beforeEach(async ({ page }) => {
    context = await setup({ page, isEmptyProject: true });
    dashboard = new DashboardPage(page, context.project);
    grid = dashboard.grid;

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
      const project = await api.project.read(context.project.id);
      table = await api.base.tableCreate(context.project.id, project.bases?.[0].id, {
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
      await api.dbTableRow.bulkCreate('noco', context.project.id, table.id, RowAttributes);
    } catch (e) {
      console.log(e);
    }

    // reload page after api calls
    await page.reload();
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
    await undo({ page });
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
    await undo({ page });
    await kanban.verifyCardCount({
      count: [0, 2, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    });
  });
});
