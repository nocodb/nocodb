import { test } from '@playwright/test';
import { DashboardPage } from '../../pages/Dashboard';
import setup from '../../setup';
import { AccountPage } from '../../pages/Account';
import { AccountLicensePage } from '../../pages/Account/License';

test.describe.skip('Attachment column', () => {
  let dashboard: DashboardPage;
  let accountLicensePage: AccountLicensePage, accountPage: AccountPage, context: any;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page, isEmptyProject: false, isSuperUser: true });
    dashboard = new DashboardPage(page, context.project);
    accountPage = new AccountPage(page);
    accountLicensePage = new AccountLicensePage(accountPage);
  });

  test('Attachment enterprise features,', async () => {
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
