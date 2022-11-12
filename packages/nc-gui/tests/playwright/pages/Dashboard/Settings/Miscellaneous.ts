import { expect } from '@playwright/test';
import { SettingsPage } from '.';
import BasePage from '../../Base';

export class MiscSettingsPage extends BasePage {
  private readonly settings: SettingsPage;

  constructor(settings: SettingsPage) {
    super(settings.rootPage);
    this.settings = settings;
  }

  get() {
    return this.settings.get().locator(`[data-testid="nc-settings-subtab-Miscellaneous"]`);
  }

  async clickShowM2MTables() {
    await this.get().locator('input[type="checkbox"]').click();
  }
}
