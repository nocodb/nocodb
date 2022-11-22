import { test } from '@playwright/test';
import { DashboardPage } from '../pages/Dashboard';
import setup from '../setup';
import { isMysql, isPg, isSqlite } from '../setup/db';

test.describe('Shared view', () => {
  let dashboard: DashboardPage;
  let context: any;

  let sharedLink: string;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page });
    dashboard = new DashboardPage(page, context.project);
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
    // sort
    await dashboard.grid.toolbar.sort.addSort({
      columnTitle: 'District',
      isAscending: false,
      isLocallySaved: false,
    });
    // filter
    await dashboard.grid.toolbar.filter.addNew({
      columnTitle: 'Address',
      value: 'Ab',
      opType: 'is like',
      isLocallySaved: false,
    });

    // share with password disabled, download enabled
    await dashboard.grid.toolbar.clickShareView();
    sharedLink = await dashboard.grid.toolbar.shareView.getShareLink();

    /**
     * 2. Access shared view: verify
     * - access without password
     * - column order
     * - data order (sort & filter)
     * - virtual columns (hm, bt)
     **/

    await page.goto(sharedLink);
    const sharedPage = new DashboardPage(page, context.project);

    const expectedColumns = [
      { title: 'Address', isVisible: true },
      { title: 'Address2', isVisible: false },
      { title: 'District', isVisible: true },
      { title: 'City', isVisible: true },
      { title: 'PostalCode', isVisible: true },
      { title: 'Phone', isVisible: true },
      { title: 'LastUpdate', isVisible: true },
      { title: 'Customer List', isVisible: true },
      { title: 'Staff List', isVisible: true },
      { title: 'City', isVisible: true },
    ];
    for (const column of expectedColumns) {
      await sharedPage.grid.column.verify(column);
    }

    const expectedRecordsByDb = isSqlite(context) || isPg(context) ? sqliteExpectedRecords : expectedRecords;
    // verify order of records (original sort & filter)
    for (const record of expectedRecordsByDb) {
      await sharedPage.grid.cell.verify(record);
    }

    const expectedVirtualRecordsByDb =
      isSqlite(context) || isPg(context) ? sqliteExpectedVirtualRecords : expectedVirtualRecords;

    // verify virtual records
    for (const record of expectedVirtualRecordsByDb) {
      await sharedPage.grid.cell.verifyVirtualCell(record);
    }

    /**
     * 3. Shared view: verify
     * - new sort
     * - new filter
     * - new column hidden
     **/

    // create new sort & filter criteria in shared view
    await sharedPage.grid.toolbar.sort.addSort({
      columnTitle: 'Address',
      isAscending: true,
      isLocallySaved: true,
    });

    if (isMysql(context)) {
      await sharedPage.grid.toolbar.filter.addNew({
        columnTitle: 'District',
        value: 'Ta',
        opType: 'is like',
        isLocallySaved: true,
      });
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

    // enable password & verify share link
    await dashboard.grid.toolbar.clickShareView();
    await dashboard.grid.toolbar.shareView.enablePassword('p@ssword');
    // disable download
    await dashboard.grid.toolbar.shareView.toggleDownload();

    sharedLink = await dashboard.grid.toolbar.shareView.getShareLink();
    await dashboard.grid.toolbar.shareView.close();

    // add new column, record after share view creation
    await dashboard.grid.column.create({
      title: 'New Column',
    });
    await dashboard.grid.addNewRow({
      index: 25,
      columnHeader: 'Country',
      value: 'New Country',
    });

    await page.goto(sharedLink);

    // todo: Create shared view page
    // verify if password request modal exists
    const sharedPage2 = new DashboardPage(page, context.project);
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
    await sharedPage2.grid.toolbar.filter.addNew({
      columnTitle: 'Country',
      value: 'New Country',
      opType: 'is like',
      isLocallySaved: true,
    });
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
    value: '1892 Nabereznyje Telny Lane',
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
  { index: 0, columnHeader: 'Customer List', count: 1, value: ['2'] },
  { index: 1, columnHeader: 'Customer List', count: 1, value: ['2'] },
  { index: 0, columnHeader: 'City', count: 1, value: ['Kanchrapara'] },
  { index: 1, columnHeader: 'City', count: 1, value: ['Tafuna'] },
];

const sqliteExpectedVirtualRecords = [
  { index: 0, columnHeader: 'Customer List', count: 1, value: ['2'] },
  { index: 1, columnHeader: 'Customer List', count: 1, value: ['1'] },
  { index: 0, columnHeader: 'City', count: 1, value: ['Davao'] },
  { index: 1, columnHeader: 'City', count: 1, value: ['Nagareyama'] },
];
