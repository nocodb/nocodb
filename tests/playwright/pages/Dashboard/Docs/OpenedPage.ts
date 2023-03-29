import { expect } from '@playwright/test';
import { DashboardPage } from '..';
import BasePage from '../../Base';

export class DocsOpenedPagePage extends BasePage {
  readonly dashboard: DashboardPage;

  constructor(dashboard: DashboardPage) {
    super(dashboard.rootPage);
    this.dashboard = dashboard;
  }

  get() {
    return this.dashboard.get().getByTestId('docs-opened-page');
  }

  async waitForRender() {
    await this.get().waitFor({ state: 'visible' });
    await this.get().getByTestId('docs-page-title').waitFor({ state: 'visible' });
    await this.get()
      .getByTestId('docs-page-title')
      .elementHandle()
      .then(async el => {
        await el?.waitForElementState('stable');
      });
  }

  async verifyOpenedPageVisible() {
    await expect(this.get()).toBeVisible();
  }
}
