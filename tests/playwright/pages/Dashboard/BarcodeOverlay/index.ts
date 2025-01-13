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

  async verifyBarcodeSvgValue(expectedValue: string) {
    const foundBarcodeSvg = await this.get().getByTestId('barcode').innerHTML();
    expect(foundBarcodeSvg).toContain(expectedValue);
  }

  async clickCloseButton() {
    await this.get().locator('.nc-barcode-close').click();
  }
}
