import { expect, test } from '@playwright/test';
import { DashboardPage } from '../../../pages/Dashboard';
import setup, { unsetup } from '../../../setup';

// Todo: Enable this test once we enable this feature for all
test.describe.skip('Expanded form files mode', () => {
  let dashboard: DashboardPage;
  let context: any;

  test.beforeEach(async ({ page }) => {
    context = await setup({ page, isEmptyProject: false });
    dashboard = new DashboardPage(page, context.base);
  });

  test.afterEach(async () => {
    await unsetup(context);
  });

  async function addFileToRow(rowIndex: number, filePathAppned: string[]) {
    await dashboard.grid.cell.attachment.addFile({
      index: rowIndex,
      columnHeader: 'testAttach',
      filePath: filePathAppned.map(filePath => `${__dirname}/../../../fixtures/sampleFiles/${filePath}`),
    });

    await dashboard.rootPage.waitForTimeout(500);

    await dashboard.grid.cell.attachment.verifyFileCount({
      index: rowIndex,
      columnHeader: 'testAttach',
      count: filePathAppned.length,
    });
  }

  test('Mode switch and functionality', async () => {
    test.slow();

    await dashboard.treeView.openTable({ title: 'Country' });
    await dashboard.grid.column.create({
      title: 'testAttach',
      type: 'Attachment',
    });

    await addFileToRow(0, ['1.json']);
    await addFileToRow(2, ['1.json', '2.json']);

    await dashboard.grid.openExpandedRow({ index: 0 });
    await dashboard.expandedForm.verifyTableNameShown({ name: 'Country' });

    await dashboard.expandedForm.verifyIsInFieldsMode();
    await dashboard.expandedForm.switchToFilesMode();
    await dashboard.expandedForm.verifyIsInFilesMode();

    await expect(dashboard.expandedForm.cnt_filesModeContainer).toBeVisible();
    await expect(dashboard.expandedForm.cnt_filesNoAttachmentField).not.toBeVisible();
    await expect(dashboard.expandedForm.cnt_filesAttachmentHeader).toBeVisible();
    await expect(dashboard.expandedForm.cnt_filesCurrentAttachmentTitle).toBeVisible();
    await expect(dashboard.expandedForm.cnt_filesNoAttachment).not.toBeVisible();

    await expect(dashboard.expandedForm.cnt_filesCurrentFieldTitle).toHaveText('testAttach');
    await expect(dashboard.expandedForm.cnt_filesCurrentAttachmentTitle).toHaveText('1.json');

    await dashboard.expandedForm.verifyFilesViewerMode({ mode: 'unsupported' });
  });

  test('Various file types correct rendering', async () => {
    test.slow();

    await dashboard.treeView.openTable({ title: 'Country' });
    await dashboard.grid.column.create({
      title: 'testAttach',
      type: 'Attachment',
    });

    await addFileToRow(1, ['1.json', 'sampleImage.jpeg', 'sample.mp4', 'sample.pdf', 'sample.mp3']);
    await addFileToRow(2, ['1.json']);

    await dashboard.grid.openExpandedRow({ index: 0 });

    await dashboard.expandedForm.switchToFilesMode();
    await dashboard.expandedForm.verifyIsInFilesMode();

    await expect(dashboard.expandedForm.cnt_filesModeContainer).toBeVisible();
    await expect(dashboard.expandedForm.cnt_filesNoAttachmentField).not.toBeVisible();
    await expect(dashboard.expandedForm.cnt_filesAttachmentHeader).toBeVisible();
    await expect(dashboard.expandedForm.cnt_filesCurrentAttachmentTitle).not.toBeVisible();
    await expect(dashboard.expandedForm.cnt_filesNoAttachment).toBeVisible();
    await expect(dashboard.expandedForm.cnt_filesCurrentFieldTitle).toHaveText('testAttach');

    await dashboard.expandedForm.close();
    await dashboard.grid.openExpandedRow({ index: 1 });

    await dashboard.expandedForm.verifyIsInFieldsMode();
    await dashboard.expandedForm.switchToFilesMode();
    await dashboard.expandedForm.verifyIsInFilesMode();

    await expect(dashboard.expandedForm.cnt_filesModeContainer).toBeVisible();
    await expect(dashboard.expandedForm.cnt_filesNoAttachmentField).not.toBeVisible();
    await expect(dashboard.expandedForm.cnt_filesAttachmentHeader).toBeVisible();
    await expect(dashboard.expandedForm.cnt_filesCurrentAttachmentTitle).toBeVisible();
    await expect(dashboard.expandedForm.cnt_filesNoAttachment).not.toBeVisible();
    await expect(dashboard.expandedForm.cnt_filesCurrentFieldTitle).toHaveText('testAttach');

    await dashboard.expandedForm.verifyPreviewCellsCount({ count: 5 });
    await expect(dashboard.expandedForm.cnt_filesCurrentAttachmentTitle).toHaveText('1.json');
    await dashboard.expandedForm.verifyFilesViewerMode({ mode: 'unsupported' });

    await dashboard.expandedForm.selectNthFilePreviewCell({ index: 1 });
    await dashboard.expandedForm.verifyFilesViewerMode({ mode: 'image' });

    await dashboard.expandedForm.selectNthFilePreviewCell({ index: 2 });
    await dashboard.expandedForm.verifyFilesViewerMode({ mode: 'video' });

    await dashboard.expandedForm.selectNthFilePreviewCell({ index: 3 });
    await dashboard.expandedForm.verifyFilesViewerMode({ mode: 'pdf' });

    await dashboard.expandedForm.selectNthFilePreviewCell({ index: 4 });
    await dashboard.expandedForm.verifyFilesViewerMode({ mode: 'audio' });

    await dashboard.expandedForm.moveToNextField();
    await dashboard.expandedForm.verifyIsInFilesMode();

    await dashboard.expandedForm.verifyPreviewCellsCount({ count: 5 });
    await expect(dashboard.expandedForm.cnt_filesCurrentAttachmentTitle).toHaveText('1.json');
    await dashboard.expandedForm.verifyFilesViewerMode({ mode: 'unsupported' });
  });
});
