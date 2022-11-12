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

  async addFile({ index, columnHeader, filePath }: { index?: number; columnHeader: string; filePath: string }) {
    const attachFileAction = this.get({ index, columnHeader })
      .locator('[data-testid="attachment-cell-file-picker-button"]')
      .click();
    return await this.attachFile({ filePickUIAction: attachFileAction, filePath });
  }

  async verifyFile({ index, columnHeader }: { index: number; columnHeader: string }) {
    await expect(await this.get({ index, columnHeader }).locator('.nc-attachment')).toBeVisible();
  }
}
