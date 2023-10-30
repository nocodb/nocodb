import { test } from '@playwright/test';
import { DashboardPage } from '../../../pages/Dashboard';
import setup from '../../../setup';
import { isMysql, isPg, isSqlite } from '../../../setup/db';

test.describe('Shared view', () => {
  let dashboard: DashboardPage;
  let context: any;

  let sharedLink: string;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page, isEmptyProject: false });
    dashboard = new DashboardPage(page, context.base);
  });

  test('Grid Share with GroupBy', async ({ page }) => {
    await dashboard.treeView.openTable({ title: 'Film' });
    await dashboard.grid.toolbar.clickGroupBy();

    await dashboard.grid.toolbar.groupBy.add({
      title: 'Title',
      ascending: false,
      locallySaved: false,
    });
    await dashboard.grid.toolbar.clickGroupBy();
    await dashboard.grid.toolbar.sort.add({
      title: 'Title',
      ascending: false,
      locallySaved: false,
    });

    sharedLink = await dashboard.grid.topbar.getSharedViewUrl();
    await page.goto(sharedLink);

    // fix me! kludge@hub; page wasn't getting loaded from previous step
    await page.reload();
    const sharedPage = new DashboardPage(page, context.base);
    await sharedPage.grid.groupPage.openGroup({ indexMap: [0] });

    await sharedPage.grid.groupPage.validateFirstRow({
      indexMap: [0],
      rowIndex: 0,
      columnHeader: 'Title',
      value: 'ZORRO ARK',
    });

    // Goto dashboard and Create Filter and verify shared view
    await dashboard.goto();
    await page.reload();

    await dashboard.treeView.openTable({ title: 'Film' });

    await dashboard.grid.toolbar.clickFilter();
    await dashboard.grid.toolbar.filter.add({
      title: 'Length',
      operation: '=',
      value: '180',
    });
    await dashboard.grid.toolbar.clickFilter();

    await page.goto(sharedLink);
    await page.reload();

    await sharedPage.grid.groupPage.openGroup({ indexMap: [0] });
    await sharedPage.grid.groupPage.validateFirstRow({
      indexMap: [0],
      rowIndex: 0,
      columnHeader: 'Title',
      value: 'SOMETHING DUCK',
    });

    // Goto dashboard and Update Group, Remove Filter and verify shared view

    await dashboard.goto();
    await page.reload();

    await dashboard.treeView.openTable({ title: 'Film' });
    await dashboard.grid.toolbar.clickGroupBy();
    await dashboard.grid.toolbar.groupBy.update({
      index: 0,
      title: 'Length',
      ascending: false,
    });

    await dashboard.grid.toolbar.filter.reset();

    await page.goto(sharedLink);
    await page.reload();

    await sharedPage.grid.groupPage.openGroup({ indexMap: [0] });
    await sharedPage.grid.groupPage.validateFirstRow({
      indexMap: [0],
      rowIndex: 0,
      columnHeader: 'Title',
      value: 'WORST BANGER',
    });

    await dashboard.goto();
    await page.reload();
    // kludge: wait for 3 seconds to avoid flaky test
    await page.waitForTimeout(5000);

    await dashboard.treeView.openTable({ title: 'Film' });
    await dashboard.grid.toolbar.clickGroupBy();
    await dashboard.grid.toolbar.groupBy.remove({ index: 0 });
    await dashboard.grid.toolbar.clickGroupBy();

    await page.goto(sharedLink);
    await page.reload();
    // kludge: wait for 3 seconds to avoid flaky test
    await page.waitForTimeout(5000);

    await sharedPage.grid.cell.verify({ index: 0, columnHeader: 'Title', value: 'ZORRO ARK' });
  });

  test('Grid share ', async ({ page }) => {
    /**
     * 1. Create Shared view
     * - hide column
     * - add sort
     * - add filter
     * - enable download
     * - disable password
     * - generate shared view link
     * - copy link
     **/

    // close 'Team & Auth' tab
    await dashboard.closeTab({ title: 'Team & Auth' });
    await dashboard.treeView.openTable({ title: 'Address' });

    // hide column
    await dashboard.grid.toolbar.fields.toggle({ title: 'Address2' });
    await dashboard.grid.toolbar.fields.toggle({ title: 'Stores' });

    // sort
    await dashboard.grid.toolbar.sort.add({
      title: 'District',
      ascending: false,
      locallySaved: false,
    });
    // filter
    await dashboard.grid.toolbar.clickFilter();
    await dashboard.grid.toolbar.filter.add({
      title: 'Address',
      value: 'Ab',
      operation: 'is like',
      locallySaved: false,
    });
    await dashboard.grid.toolbar.clickFilter();

    // share with password disabled, download enabled
    sharedLink = await dashboard.grid.topbar.getSharedViewUrl();

    /**
     * 2. Access shared view: verify
     * - access without password
     * - column order
     * - data order (sort & filter)
     * - virtual columns (hm, bt)
     **/

    await page.goto(sharedLink);
    // fix me! kludge@hub; page wasn't getting loaded from previous step
    await page.reload();
    const sharedPage = new DashboardPage(page, context.base);

    const expectedColumns = [
      { title: 'Address', isVisible: true },
      { title: 'Address2', isVisible: false },
      { title: 'District', isVisible: true },
      { title: 'City', isVisible: true },
      { title: 'PostalCode', isVisible: true },
      { title: 'Phone', isVisible: true },
      { title: 'LastUpdate', isVisible: true },
      { title: 'Customers', isVisible: true },
      { title: 'Staffs', isVisible: true },
      { title: 'Stores', isVisible: false },
      { title: 'City', isVisible: true },
    ];
    for (const column of expectedColumns) {
      await sharedPage.grid.column.verify(column);
    }

    const expectedRecordsByDb = isSqlite(context) || isPg(context) ? sqliteExpectedRecords : expectedRecords;
    await new Promise(resolve => setTimeout(resolve, 1000));
    // verify order of records (original sort & filter)
    for (const record of expectedRecordsByDb) {
      await sharedPage.grid.cell.verify(record);
    }

    const expectedVirtualRecordsByDb =
      isSqlite(context) || isPg(context) ? sqliteExpectedVirtualRecords : expectedVirtualRecords;

    // verify virtual records
    for (const record of expectedVirtualRecordsByDb) {
      await sharedPage.grid.cell.verifyVirtualCell({
        ...record,
        options: { singular: 'Customer', plural: 'Customers' },
        verifyChildList: true,
      });
    }

    /**
     * 3. Shared view: verify
     * - new sort
     * - new filter
     * - new column hidden
     **/

    // create new sort & filter criteria in shared view
    await sharedPage.grid.toolbar.sort.add({
      title: 'Address',
      ascending: true,
      locallySaved: true,
    });

    if (isMysql(context)) {
      await sharedPage.grid.toolbar.clickFilter();
      await sharedPage.grid.toolbar.filter.add({
        title: 'District',
        value: 'Ta',
        operation: 'is like',
        locallySaved: true,
      });
      await sharedPage.grid.toolbar.clickFilter();
    }
    await sharedPage.grid.toolbar.fields.toggle({ title: 'LastUpdate', isLocallySaved: true });
    expectedColumns[6].isVisible = false;

    // verify new sort & filter criteria
    for (const column of expectedColumns) {
      await sharedPage.grid.column.verify(column);
    }

    const expectedRecordsByDb2 = isSqlite(context) || isPg(context) ? sqliteExpectedRecords2 : expectedRecords2;
    // verify order of records (original sort & filter)
    for (const record of expectedRecordsByDb2) {
      await sharedPage.grid.cell.verify(record);
    }

    /**
     * 4. Download
     * - Verify download data (order, filter, sort)
     **/

    // verify download
    await sharedPage.grid.toolbar.clickDownload(
      'Download as CSV',
      isSqlite(context) || isPg(context) ? 'expectedDataSqlite.txt' : 'expectedData.txt'
    );
  });

  test('Shared view: password', async ({ page }) => {
    /**
     * 5. Enable shared view password, disable download: verify
     * - Incorrect password
     * - Correct password
     * - Download disabled
     * - Add new record & column after shared view creation; verify
     **/

    await dashboard.closeTab({ title: 'Team & Auth' });
    await dashboard.treeView.openTable({ title: 'Country' });

    sharedLink = await dashboard.grid.topbar.getSharedViewUrl(false, 'p@ssword', true);

    // add new column, record after share view creation
    await dashboard.grid.column.create({
      title: 'New Column',
    });
    await dashboard.grid.addNewRow({
      index: 25,
      columnHeader: 'Country',
      value: 'New Country',
    });

    await dashboard.signOut();

    await page.goto(sharedLink);
    await page.reload();

    // verify if password request modal exists
    const sharedPage2 = new DashboardPage(page, context.base);
    await sharedPage2.rootPage.locator('input[placeholder="Enter password"]').fill('incorrect p@ssword');
    await sharedPage2.rootPage.click('button:has-text("Unlock")');
    await sharedPage2.verifyToast({ message: 'INVALID_SHARED_VIEW_PASSWORD' });

    // correct password
    await sharedPage2.rootPage.locator('input[placeholder="Enter password"]').fill('p@ssword');
    await sharedPage2.rootPage.click('button:has-text("Unlock")');

    // verify if download button is disabled
    await sharedPage2.grid.toolbar.verifyDownloadDisabled();

    // verify new column & record
    await sharedPage2.grid.column.verify({
      title: 'New Column',
      isVisible: true,
    });
    await sharedPage2.grid.toolbar.clickFilter();
    await sharedPage2.grid.toolbar.filter.add({
      title: 'Country',
      value: 'New Country',
      operation: 'is like',
      locallySaved: true,
    });
    await sharedPage2.grid.toolbar.clickFilter();

    await sharedPage2.grid.cell.verify({
      index: 0,
      columnHeader: 'Country',
      value: 'New Country',
    });
  });
});

const expectedRecords = [
  { index: 0, columnHeader: 'Address', value: '1013 Tabuk Boulevard' },
  {
    index: 1,
    columnHeader: 'Address',
    value: '1892 Nabereznyje Telny',
  },
  { index: 2, columnHeader: 'Address', value: '1993 Tabuk Lane' },
  { index: 0, columnHeader: 'District', value: 'West Bengali' },
  { index: 1, columnHeader: 'District', value: 'Tutuila' },
  { index: 2, columnHeader: 'District', value: 'Tamil Nadu' },
  { index: 0, columnHeader: 'PostalCode', value: '96203' },
  { index: 1, columnHeader: 'PostalCode', value: '28396' },
  { index: 2, columnHeader: 'PostalCode', value: '64221' },
  { index: 0, columnHeader: 'Phone', value: '158399646978' },
  { index: 1, columnHeader: 'Phone', value: '478229987054' },
  { index: 2, columnHeader: 'Phone', value: '648482415405' },
];

// const sqliteExpectedRecords = [
//   { index: 0, columnHeader: 'Address', value: '669 Firozabad Loop' },
//   { index: 1, columnHeader: 'Address', value: '48 Maracabo Place' },
//   { index: 2, columnHeader: 'Address', value: '44 Najafabad Way' },
//   { index: 0, columnHeader: 'PostalCode', value: '92265' },
//   { index: 1, columnHeader: 'PostalCode', value: '1570' },
//   { index: 2, columnHeader: 'PostalCode', value: '61391' },
// ];
const sqliteExpectedRecords = [
  { index: 0, columnHeader: 'Address', value: '217 Botshabelo Place' },
  { index: 1, columnHeader: 'Address', value: '17 Kabul Boulevard' },
  { index: 2, columnHeader: 'Address', value: '1888 Kabul Drive' },
  { index: 0, columnHeader: 'PostalCode', value: '49521' },
  { index: 1, columnHeader: 'PostalCode', value: '38594' },
  { index: 2, columnHeader: 'PostalCode', value: '20936' },
];
const expectedRecords2 = [
  { index: 0, columnHeader: 'Address', value: '1661 Abha Drive' },
  { index: 1, columnHeader: 'Address', value: '1993 Tabuk Lane' },
  { index: 2, columnHeader: 'Address', value: '381 Kabul Way' },
  { index: 0, columnHeader: 'District', value: 'Tamil Nadu' },
  { index: 1, columnHeader: 'District', value: 'Tamil Nadu' },
  { index: 2, columnHeader: 'District', value: 'Taipei' },
  { index: 0, columnHeader: 'PostalCode', value: '14400' },
  { index: 1, columnHeader: 'PostalCode', value: '64221' },
  { index: 2, columnHeader: 'PostalCode', value: '87272' },
  { index: 0, columnHeader: 'Phone', value: '270456873752' },
  { index: 1, columnHeader: 'Phone', value: '648482415405' },
  { index: 2, columnHeader: 'Phone', value: '55477302294' },
];

const sqliteExpectedRecords2 = [
  { index: 0, columnHeader: 'Address', value: '1013 Tabuk Boulevard' },
  { index: 1, columnHeader: 'Address', value: '1168 Najafabad Parkway' },
  { index: 2, columnHeader: 'Address', value: '1294 Firozabad Drive' },
  { index: 0, columnHeader: 'PostalCode', value: '96203' },
  { index: 1, columnHeader: 'PostalCode', value: '40301' },
  { index: 2, columnHeader: 'PostalCode', value: '70618' },
];

const expectedVirtualRecords = [
  { index: 0, columnHeader: 'Customers', count: 1, type: 'hm' },
  { index: 1, columnHeader: 'Customers', count: 1, type: 'hm' },
  { index: 0, columnHeader: 'City', count: 1, type: 'bt', value: ['Kanchrapara'] },
  { index: 1, columnHeader: 'City', count: 1, type: 'bt', value: ['Tafuna'] },
];

const sqliteExpectedVirtualRecords = [
  { index: 0, columnHeader: 'Customers', count: 1, type: 'hm' },
  { index: 1, columnHeader: 'Customers', count: 1, type: 'hm' },
  { index: 0, columnHeader: 'City', count: 1, type: 'bt', value: ['Davao'] },
  { index: 1, columnHeader: 'City', count: 1, type: 'bt', value: ['Nagareyama'] },
];
