import BasePage from '../../Base';
import { ProjectViewPage } from './index';
import { expect, Locator } from '@playwright/test';

export class TablesViewPage extends BasePage {
  readonly baseView: ProjectViewPage;

  readonly btn_addNewTable: Locator;
  readonly btn_importData: Locator;

  constructor(baseView: ProjectViewPage) {
    super(baseView.rootPage);
    this.baseView = baseView;

    this.btn_addNewTable = this.get().locator('[data-testid="proj-view-btn__add-new-table"]');
    this.btn_importData = this.get().locator('[data-testid="proj-view-btn__import-data"]');
  }

  get() {
    return this.rootPage.locator('.nc-all-tables-view');
  }

  async verifyAccess(role: string) {
    await this.get().waitFor({ state: 'visible' });

    if (role.toLowerCase() === 'creator' || role.toLowerCase() === 'owner') {
      await expect(this.btn_addNewTable).toBeVisible();
      await expect(this.btn_importData).toBeVisible();
    } else {
      await expect(this.btn_addNewTable).toHaveCount(0);
      await expect(this.btn_importData).toHaveCount(0);
    }
  }
}
