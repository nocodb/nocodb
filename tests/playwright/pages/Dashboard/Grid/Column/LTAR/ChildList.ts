import BasePage from '../../../../Base';
import { DashboardPage } from '../../../index';
import { expect } from '@playwright/test';

export class ChildList extends BasePage {
  readonly dashboard: DashboardPage;

  constructor(dashboard: DashboardPage) {
    super(dashboard.rootPage);
    this.dashboard = dashboard;
  }

  get() {
    return this.dashboard.get().locator(`.nc-modal-child-list`);
  }

  async verify({ cardTitle, linkField: _linkField }: { cardTitle: string[]; linkField: string }) {
    await this.get().locator('.nc-dropdown-link-record-header').waitFor();

    // Filter the list per-title so each assertion is against a stable top result.
    // Avoids depending on DOM nth(i) == list index, which is unstable once the
    // list scrolls (virtualized/infinite-scroll windows shift on scroll).
    const searchInput = this.get().locator('.nc-dropdown-link-record-search-wrapper input').first();
    const firstItem = this.get().getByTestId('nc-child-list-item').first();

    for (const title of cardTitle) {
      await searchInput.fill(title);
      await firstItem.locator('.nc-display-value').waitFor({ state: 'visible' });
      await expect
        .poll(async () => (await firstItem.locator('.nc-display-value').textContent())?.trim())
        .toContain(title);
    }

    // Reset the filter so the modal returns to the unfiltered state for any
    // follow-up interaction.
    await searchInput.fill('');
  }

  async close() {
    // await this.get().locator(`.nc-close-btn`).click();
    await this.rootPage.keyboard.press('Escape');
    await this.get().waitFor({ state: 'hidden' });
  }

  async openLinkRecord({ linkTableTitle }: { linkTableTitle: string }) {
    const openActions = () => this.get().getByTestId('nc-child-list-button-link-to').click();
    await this.waitForResponse({
      requestUrlPathToMatch: '/exclude',
      httpMethodsToMatch: ['GET'],
      uiAction: openActions,
    });
  }
}
