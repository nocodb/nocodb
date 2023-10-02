import { expect } from '@playwright/test';
import { DashboardPage } from '..';
import BasePage from '../../Base';

export class DocsPageListPage extends BasePage {
  readonly dashboard: DashboardPage;

  constructor(dashboard: DashboardPage) {
    super(dashboard.rootPage);
    this.dashboard = dashboard;
  }

  get() {
    return this.dashboard.get().getByTestId('docs-page-list');
  }

  async verifyProjectTitle({ title }: { title: string }) {
    expect(await this.get().getByTestId('docs-base-title').textContent()).toBe(title);
  }

  async verifyOpenedTab({ tab }: { tab: 'all' | 'allByTitle' | 'shared' }) {
    await expect(this.get().locator(`[data-testActiveTabKey="${tab}"]`)).toBeVisible();
  }

  async waitForOpen({ title }: { title: string }) {
    await this.get().locator(`[data-docs-base-title="${title}"]`).waitFor({ state: 'visible' });
  }

  async openTab({ tab }: { tab: 'all' | 'allByTitle' | 'shared' }) {
    await this.rootPage.getByTestId(`nc-docs-pagelist-tab-button-${tab}`).click();
  }

  async verifyPageInList({
    title,
    index,
    tab,
  }: {
    title: string;
    index?: number;
    tab: 'all' | 'allByTitle' | 'shared';
  }) {
    if (index) {
      await expect(
        this.get()
          .locator(`[data-testactivetabkey="${tab}"]`)
          .locator(`.docs-pagelist-page:nth-child(${index + 1})`)
          .getByTestId(`docs-pagelist-page-${title}`)
      ).toBeVisible();
    } else {
      await expect(
        this.get().locator(`[data-testactivetabkey="${tab}"]`).getByTestId(`docs-pagelist-page-${title}`)
      ).toBeVisible();
    }
  }
}
