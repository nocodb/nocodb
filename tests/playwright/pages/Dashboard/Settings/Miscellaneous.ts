import { SettingsPage } from '.';
import BasePage from '../../Base';

export class MiscSettingsPage extends BasePage {
  private readonly settings: SettingsPage;

  constructor(settings: SettingsPage) {
    super(settings.rootPage);
    this.settings = settings;
  }

  get() {
    return this.settings.get().locator(`[data-testid="nc-settings-subtab-Misc"]`);
  }

  async clickShowM2MTables() {
    const clickAction = () => this.get().locator('input[type="checkbox"]').first().click();
    await this.waitForResponse({
      uiAction: clickAction,
      requestUrlPathToMatch: 'tables?includeM2M',
      httpMethodsToMatch: ['GET'],
    });
  }

  async clickShowNullEmptyFilters() {
    await this.waitForResponse({
      uiAction: () => this.get().locator('input[type="checkbox"]').last().click(),
      requestUrlPathToMatch: '/api/v1/db/meta/projects',
      httpMethodsToMatch: ['PATCH'],
    });
  }
}
