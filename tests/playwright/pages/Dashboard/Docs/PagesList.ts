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
    expect(await this.get().getByTestId('docs-project-title').textContent()).toBe(title);
  }

  async waitForOpen({ title }: { title: string }) {
    await this.get().locator(`[data-docs-project-title="${title}"]`).waitFor({ state: 'visible' });
  }
}
