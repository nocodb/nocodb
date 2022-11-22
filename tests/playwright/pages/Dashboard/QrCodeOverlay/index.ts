import { expect } from '@playwright/test';
import BasePage from '../../Base';
import { FormPage } from '../Form';
import { GalleryPage } from '../Gallery';
import { GridPage } from '../Grid';
import { KanbanPage } from '../Kanban';

export class QrCodeOverlay extends BasePage {
  constructor(parent: GridPage | GalleryPage | KanbanPage | FormPage) {
    super(parent.rootPage);
  }

  get() {
    return this.rootPage.locator(`.nc-qr-code-large`);
  }

  async verifyQrValueLabel(expectedValue: string) {
    const foundQrValueLabelText = await this.get()
      .locator('[data-testid="nc-qr-code-large-value-label"]')
      .textContent();
    await expect(foundQrValueLabelText).toContain(expectedValue);
  }

  // async toggle() {
  //   await this.rootPage.locator('[data-testid="nc-project-menu"]').click();
  // }

  async clickCloseButton() {
    // const closeButton = await this.get().locator('.ant-modal-close-x').click();
    await this.get().locator('.ant-modal-close-x').click();
    // const closeButton = await this.rootPage.locator('[data-testid="nc-qr-code-large"]');
  }

  // async click({ menu, subMenu }: { menu: string; subMenu: string }) {
  //   const pMenu = await this.rootPage.locator(`.nc-dropdown-project-menu:visible`);
  //   await pMenu.locator(`div.nc-project-menu-item:has-text("${menu}"):visible`).click();
  //   await this.rootPage.waitForTimeout(2000);

  //   if (subMenu) {
  //     await this.rootPage.locator(`div.nc-project-menu-item:has-text("${subMenu}"):visible`).click();
  //     await this.rootPage.waitForTimeout(1000);
  //   }
  // }

  // async clickPreview(role: string) {
  //   await this.click({
  //     menu: 'Preview as',
  //     subMenu: role,
  //   });
  //   await this.rootPage.waitForTimeout(2500);
  // }
}
