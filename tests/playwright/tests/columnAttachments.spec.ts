import { expect, test } from '@playwright/test';
import { DashboardPage } from '../pages/Dashboard';
import { SharedFormPage } from '../pages/SharedForm';
import setup from '../setup';
import { AccountPage } from '../pages/Account';
import { AccountLicensePage } from '../pages/Account/License';

// was green when run individually via .only
// on bbed1f864945fa61e3d92e3e2c8dfa783060b302
test.describe('Attachment column', () => {
  let dashboard: DashboardPage;
  let accountLicensePage: AccountLicensePage, accountPage: AccountPage, context: any;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page });
    dashboard = new DashboardPage(page, context.project);
    accountPage = new AccountPage(page);
    accountLicensePage = new AccountLicensePage(accountPage);
  });

  test('Create and verify attachment column, verify it in shared form,', async ({ page, context }) => {
    // run tests slowly
    test.slow();

    await dashboard.treeView.openTable({ title: 'Country' });
    await dashboard.grid.column.create({
      title: 'testAttach',
      type: 'Attachment',
    });

    for (let i = 12; i >= 8; i -= 2) {
      const filepath = [`${process.cwd()}/fixtures/sampleFiles/${i / 2}.json`];
      await dashboard.grid.cell.attachment.addFile({
        index: i,
        columnHeader: 'testAttach',
        filePath: filepath,
      });
      await dashboard.grid.cell.attachment.verifyFile({
        index: i,
        columnHeader: 'testAttach',
      });
    }
    await dashboard.grid.cell.attachment.addFile({
      index: 14,
      columnHeader: 'testAttach',
      filePath: [`${process.cwd()}/fixtures/sampleFiles/sampleImage.jpeg`],
    });
    await dashboard.grid.cell.attachment.verifyFile({
      index: 14,
      columnHeader: 'testAttach',
    });

    await dashboard.viewSidebar.createFormView({
      title: 'Form 1',
    });
    await dashboard.form.toolbar.clickShareView();
    const sharedFormUrl = await dashboard.form.toolbar.shareView.getShareLink();
    await dashboard.form.toolbar.shareView.close();
    await dashboard.viewSidebar.openView({ title: 'Country' });

    // Verify attachment in shared form
    const newPage = await context.newPage();
    await newPage.goto(sharedFormUrl);
    const sharedForm = new SharedFormPage(newPage);
    await sharedForm.cell.fillText({
      index: 0,
      columnHeader: 'Country',
      text: 'test',
    });
    await sharedForm.cell.attachment.addFile({
      columnHeader: 'testAttach',
      filePath: [`${process.cwd()}/fixtures/sampleFiles/1.json`],
    });
    await sharedForm.submit();
    await sharedForm.verifySuccessMessage();
    await newPage.close();

    // Verify attachment in csv
    await dashboard.grid.toolbar.clickFields();
    await dashboard.grid.toolbar.fields.click({ title: 'LastUpdate' });
    await dashboard.grid.toolbar.clickActions();

    // Headless mode observation- menu doesn't render in one go
    // Download button appears before menu is fully rendered
    await dashboard.rootPage.waitForTimeout(500);

    await dashboard.grid.toolbar.actions.click('Download');

    const csvFileData: string = await dashboard.downloadAndGetFile({
      downloadUIAction: dashboard.grid.toolbar.actions.clickDownloadSubmenu('Download as CSV'),
    });
    const csvArray = csvFileData.split('\r\n');
    const columns = csvArray[0];
    const rows = csvArray.slice(1);
    const cells = rows[10].split(',');

    await expect(columns).toBe('Country,City List,testAttach');
    await expect(cells[0]).toBe('Bahrain');
    await expect(cells[1]).toBe('al-Manama');
    await expect(cells[2].includes('5.json(http://localhost:8080/download/')).toBe(true);
  });

  test('Attachment enterprise features,', async ({ page, context }) => {
    // configure enterprise key
    test.slow();
    await accountLicensePage.goto();
    await accountLicensePage.saveLicenseKey('1234567890');
    await dashboard.goto();

    await dashboard.treeView.openTable({ title: 'Country' });
    await dashboard.grid.column.create({
      title: 'testAttach',
      type: 'Attachment',
    });
    await dashboard.grid.column.attachmentColumnPageObject.advanceConfig({
      columnTitle: 'testAttach',
      fileCount: 2,
      fileSize: 1,
      // allow only image type
      fileTypesExcludeList: ['Application', 'Video', 'Audio', 'Misc'],
    });

    // in-cell, add big file, should get rejected
    const bigFile = [`${process.cwd()}/fixtures/sampleFiles/Image/6_bigSize.png`];
    await dashboard.grid.cell.attachment.addFile({
      index: 1,
      columnHeader: 'testAttach',
      filePath: bigFile,
    });
    // The size of ${file.name} exceeds the maximum file size ${attachmentMeta.maxAttachmentSize} MB.
    await dashboard.verifyToast({ message: 'The size of 6_bigSize.png exceeds the maximum file size 1 MB.' });

    // in-cell, add 2 files, should get accepted
    const twoFileArray = [
      `${process.cwd()}/fixtures/sampleFiles/Image/1.jpeg`,
      `${process.cwd()}/fixtures/sampleFiles/Image/2.png`,
    ];
    await dashboard.grid.cell.attachment.addFile({
      index: 1,
      columnHeader: 'testAttach',
      filePath: twoFileArray,
    });
    await dashboard.grid.cell.attachment.verifyFileCount({
      index: 1,
      columnHeader: 'testAttach',
      count: 2,
    });

    // add another file, should get rejected
    const oneFileArray = [`${process.cwd()}/fixtures/sampleFiles/Image/3.jpeg`];
    await dashboard.grid.cell.attachment.addFile({
      index: 1,
      columnHeader: 'testAttach',
      filePath: oneFileArray,
    });
    // wait for toast 'You can only upload at most 2 files to this cell'
    await dashboard.verifyToast({ message: 'You can only upload at most 2 files to this cell' });

    // try to upload 3 files in one go, should get rejected
    const threeFileArray = [
      `${process.cwd()}/fixtures/sampleFiles/Image/1.jpeg`,
      `${process.cwd()}/fixtures/sampleFiles/Image/2.png`,
      `${process.cwd()}/fixtures/sampleFiles/Image/3.jpeg`,
    ];
    await dashboard.grid.cell.attachment.addFile({
      index: 2,
      columnHeader: 'testAttach',
      filePath: threeFileArray,
    });
    await dashboard.verifyToast({ message: 'You can only upload at most 2 files to this cell' });

    // open expand modal, try to insert file type not supported
    // message: ${file.name} has the mime type ${file.type} which is not allowed in this column.
    await dashboard.grid.cell.attachment.addFile({
      index: 3,
      columnHeader: 'testAttach',
      filePath: [`${process.cwd()}/fixtures/sampleFiles/1.json`],
    });
    await dashboard.verifyToast({
      message: '1.json has the mime type application/json which is not allowed in this column.',
    });

    // Expand modal

    // open expand modal, try to insert more files
    await dashboard.grid.cell.attachment.expandModalOpen({
      index: 1,
      columnHeader: 'testAttach',
    });
    await dashboard.grid.cell.attachment.expandModalAddFile({
      filePath: oneFileArray,
    });
    await dashboard.verifyToast({ message: 'You can only upload at most 2 files to this cell' });

    // open expand modal, try to insert file type not supported
    // message: ${file.name} has the mime type ${file.type} which is not allowed in this column.
    await dashboard.grid.cell.attachment.expandModalAddFile({
      filePath: [`${process.cwd()}/fixtures/sampleFiles/1.json`],
    });
    await dashboard.verifyToast({
      message: '1.json has the mime type application/json which is not allowed in this column.',
    });

    // open expand modal, try to insert big file
    // message: The size of ${file.name} exceeds the maximum file size ${attachmentMeta.maxAttachmentSize} MB.
    await dashboard.grid.cell.attachment.expandModalAddFile({
      filePath: bigFile,
    });
    await dashboard.verifyToast({ message: 'The size of 6_bigSize.png exceeds the maximum file size 1 MB.' });
    await dashboard.grid.cell.attachment.expandModalClose();

    // wait for timeout
    // await dashboard.rootPage.waitForTimeout(20000);
  });
});
