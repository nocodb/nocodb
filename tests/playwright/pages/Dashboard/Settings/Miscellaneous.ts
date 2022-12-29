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
    const clickAction = this.get().locator('input[type="checkbox"]').click();
    await this.waitForResponse({
      uiAction: clickAction,
      requestUrlPathToMatch: 'tables?includeM2M',
      httpMethodsToMatch: ['GET'],
    });
  }
}
