import BasePage from '../../../Base';
import { ToolbarPage } from './index';
import { expect } from '@playwright/test';

export class ToolbarSearchDataPage extends BasePage {
  readonly toolbar: ToolbarPage;

  constructor(toolbar: ToolbarPage) {
    super(toolbar.rootPage);
    this.toolbar = toolbar;
  }

  get() {
    return this.rootPage.getByTestId('search-data-input');
  }

  async verify(query: string) {
    const searchEnableBtn = await this.rootPage
      .waitForSelector('[data-testid="nc-global-search-show-input"]', { timeout: 1000 })
      .catch(() => null);

    if (searchEnableBtn) {
      await searchEnableBtn.click();
      await this.get().waitFor({ state: 'visible' });
    }

    expect(await this.get().inputValue()).toBe(query);
  }
}
