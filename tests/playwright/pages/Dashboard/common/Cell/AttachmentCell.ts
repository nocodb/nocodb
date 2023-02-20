import { expect } from '@playwright/test';
import { CellPageObject } from '.';
import BasePage from '../../../Base';

export class AttachmentCellPageObject extends BasePage {
  readonly cell: CellPageObject;

  constructor(cell: CellPageObject) {
    super(cell.rootPage);
    this.cell = cell;
  }

  get({ index, columnHeader }: { index?: number; columnHeader: string }) {
    return this.cell.get({ index, columnHeader });
  }

  clickFilePicker({ index, columnHeader }: { index?: number; columnHeader: string }) {
    return this.get({ index, columnHeader }).locator('[data-testid="attachment-cell-file-picker-button"]').click();
  }

  // filePath: to attach multiple files, pass an array of file paths
  // e.g. ['path/to/file1', 'path/to/file2']
  //
  async addFile({ index, columnHeader, filePath }: { index?: number; columnHeader: string; filePath: string[] }) {
    const attachFileAction = this.get({ index, columnHeader })
      .locator('[data-testid="attachment-cell-file-picker-button"]')
      .click();
    return await this.attachFile({ filePickUIAction: attachFileAction, filePath });
  }

  async expandModalAddFile({ filePath }: { filePath: string[] }) {
    const attachFileAction = this.rootPage
      .locator('.ant-modal.nc-attachment-modal.active')
      .locator('[data-testid="attachment-expand-file-picker-button"]')
      .click();
    return await this.attachFile({ filePickUIAction: attachFileAction, filePath });
  }

  async expandModalOpen({ index, columnHeader }: { index?: number; columnHeader: string }) {
    return this.get({ index, columnHeader })
      .locator('.nc-cell > .nc-attachment-cell > .group.cursor-pointer')
      .last()
      .click();
  }

  async verifyFile({ index, columnHeader }: { index: number; columnHeader: string }) {
    await expect(await this.get({ index, columnHeader }).locator('.nc-attachment')).toBeVisible();
  }

  async verifyFileCount({ index, columnHeader, count }: { index: number; columnHeader: string; count: number }) {
    // retry below logic for 5 times, with 1 second delay
    let retryCount = 0;
    while (retryCount < 5) {
      const attachments = await this.get({ index, columnHeader }).locator('.nc-attachment');
      console.log(await attachments.count());
      if ((await attachments.count()) === count) {
        break;
      }
      retryCount++;
      await this.rootPage.waitForTimeout(1000);

      if (retryCount === 5) {
        expect(await attachments.count()).toBe(count);
      }
    }
  }

  async expandModalClose() {
    return this.rootPage.locator('.ant-modal.nc-attachment-modal.active').press('Escape');
  }
}
