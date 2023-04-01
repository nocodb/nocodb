import { Page } from '@playwright/test';
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

  async selectProject({ title }: { title: string }) {
    await this.get()
      .locator('.nc-project-title', {
        hasText: title,
      })
      .click();
  }
}
