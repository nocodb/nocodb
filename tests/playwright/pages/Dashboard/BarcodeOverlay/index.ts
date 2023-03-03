import { expect } from '@playwright/test';
import BasePage from '../../Base';
import { FormPage } from '../Form';
import { GalleryPage } from '../Gallery';
import { GridPage } from '../Grid';
import { KanbanPage } from '../Kanban';

export class BarcodeOverlay extends BasePage {
  constructor(parent: GridPage | GalleryPage | KanbanPage | FormPage) {
    super(parent.rootPage);
  }

  get() {
    return this.rootPage.locator(`.nc-barcode-large`);
  }

  async verifyBarcodeImgValue(expectedValue: string) {
    const foundBarcodeImg = this.get().getByTestId('barcode');
    const foundBarcodeBase64=(await foundBarcodeImg.screenshot())
    await expect(Buffer.from(foundBarcodeBase64).toString("base64")).toEqual(expectedValue);
  }

  async clickCloseButton() {
    await this.get().locator('.ant-modal-close-x').click();
  }
}
