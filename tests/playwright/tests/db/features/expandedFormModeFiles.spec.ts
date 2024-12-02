import { expect, test } from '@playwright/test';
import { DashboardPage } from '../../../pages/Dashboard';
import setup, { unsetup } from '../../../setup';

test.describe('Expanded form files mode', () => {
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
      filePath: filePathAppned.map(filePath => `${process.cwd()}/fixtures/sampleFiles/${filePath}`),
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
});
