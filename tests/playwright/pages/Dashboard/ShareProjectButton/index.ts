import { expect, Locator } from '@playwright/test';
import { DashboardPage } from '..';
import BasePage from '../../Base';

export class ShareProjectButtonPage extends BasePage {
  readonly dashboard: DashboardPage;

  constructor(dashboard: DashboardPage) {
    super(dashboard.rootPage);
    this.dashboard = dashboard;
  }

  get() {
    return this.dashboard.get().getByTestId('share-project-button');
  }

  async verifyShareStatus({ visibility }: { visibility: 'public' | 'private' }) {
    await expect(this.rootPage.locator(`[data-sharetype="${visibility}"]`)).toBeVisible();
  }
}
