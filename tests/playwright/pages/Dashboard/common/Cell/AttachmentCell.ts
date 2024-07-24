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
  async addFile({
    index,
    columnHeader,
    filePath,
    skipElemClick,
  }: {
    index?: number;
    columnHeader: string;
    filePath: string[];
    skipElemClick?: boolean;
  }) {
    await this.get({ index, columnHeader }).scrollIntoViewIfNeeded();

    if (!skipElemClick) {
      await this.get({ index, columnHeader }).click({ position: { x: 1, y: 1 } });
    }

    await this.get({ index, columnHeader }).locator('[data-testid="attachment-cell-file-picker-button"]').click();

    await this.rootPage.locator('.nc-modal-attachment-create').waitFor({ state: 'visible' });

    const attachFileAction = this.rootPage.getByTestId('attachment-drop-zone').click({ force: true });

    await this.attachFile({ filePickUIAction: attachFileAction, filePath });

    await this.rootPage.getByTestId('nc-upload-file').click();

    // wait for file to be uploaded
    await this.rootPage.waitForTimeout(750);
  }

  async removeFile({
    attIndex,
    index,
    columnHeader,
    skipElemClick,
  }: {
    attIndex: number;
    index?: number;
    columnHeader: string;
    skipElemClick?: boolean;
  }) {
    await this.get({ index, columnHeader }).scrollIntoViewIfNeeded();

    if (!skipElemClick) {
      await this.get({ index, columnHeader }).click({ position: { x: 1, y: 1 } });
    }

    await this.get({ index, columnHeader }).locator('.nc-attachment-item').nth(attIndex).hover();
    await this.get({ index, columnHeader })
      .locator('.nc-attachment-item')
      .nth(attIndex)
      .locator('.nc-attachment-remove')
      .click();

    await this.rootPage.locator('.ant-modal.active').waitFor({ state: 'visible' });
    await this.rootPage.locator('.ant-modal.active').getByTestId('nc-delete-modal-delete-btn').click();
    await this.rootPage.locator('.ant-modal.active').waitFor({ state: 'hidden' });
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
    await expect(this.get({ index, columnHeader }).locator('.nc-attachment')).toBeVisible();
  }

  async verifyFileCount({ index, columnHeader, count }: { index: number; columnHeader: string; count: number }) {
    // retry below logic for 5 times, with 1 second delay
    const attachments = this.get({ index, columnHeader }).locator('.nc-attachment');
    await expect(attachments).toHaveCount(count);
  }

  async expandModalClose() {
    return this.rootPage.locator('.ant-modal.nc-attachment-modal.active').press('Escape');
  }
}
