import { expect, Locator, Page } from '@playwright/test';
import BasePage from './Base';

export class WorkspacePage extends BasePage {
  constructor(rootPage: Page) {
    super(rootPage);
  }

  get() {
    return this.rootPage.locator('html');
  }

  async logout() {
    await this.get().getByTestId('nc-ws-account-menu-dropdown').click();
    await this.get().getByTestId('nc-logout-btn').click();
  }

  getWorkspaceContainer() {
    return this.get().locator('.nc-workspace-container');
  }

  getWorkspaceList() {
    return this.getWorkspaceContainer().locator('.nc-workspace-list');
  }

  async selectProject({ title }: { title: string }) {
    await this.get()
      .locator('.nc-project-title', {
        hasText: title,
      })
      .click();

    // TODO: Remove this timeout
    await this.rootPage.waitForTimeout(1500);
  }

  async verifyWorkspaceCount({ count }: { count: number }) {
    await expect(this.getWorkspaceList().locator('.nc-workspace-list-item')).toHaveCount(count);
  }

  // TODO: this function can be moved to tests/playwright/pages/Dashboard/index.ts
  async checkVisibleAndClick(title: string) {
    const loc: Locator = this.rootPage.getByTestId(title);
    await expect(loc).toBeVisible();
    await loc.click();
    await this.rootPage.waitForLoadState('networkidle');
  }
}
