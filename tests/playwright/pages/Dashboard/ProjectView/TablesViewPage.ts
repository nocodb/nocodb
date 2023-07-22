import BasePage from '../../Base';
import { ProjectViewPage } from './index';
import { expect, Locator } from '@playwright/test';

export class TablesViewPage extends BasePage {
  readonly projectView: ProjectViewPage;

  readonly btn_addNewTable: Locator;
  readonly btn_importData: Locator;

  constructor(projectView: ProjectViewPage) {
    super(projectView.rootPage);
    this.projectView = projectView;

    this.btn_addNewTable = this.get().locator('[data-testid="proj-view-btn__add-new-table"]');
    this.btn_importData = this.get().locator('[data-testid="proj-view-btn__import-data"]');
  }

  get() {
    return this.rootPage.locator('.nc-all-tables-view');
  }

  async verifyAccess(role: string) {
    await this.get().waitFor({ state: 'visible' });

    if (role.toLowerCase() === 'creator' || role.toLowerCase() === 'owner') {
      expect(await this.btn_addNewTable.isVisible()).toBeTruthy();
      expect(await this.btn_importData.isVisible()).toBeTruthy();
    } else {
      expect(await this.btn_addNewTable.isVisible()).toBeFalsy();
      expect(await this.btn_importData.isVisible()).toBeFalsy();
    }
  }
}
