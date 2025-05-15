import { SettingsPage } from '.';
import { isEE } from '../../../setup/db';
import BasePage from '../../Base';

export class MiscSettingsPage extends BasePage {
  private readonly settings: SettingsPage;

  constructor(settings: SettingsPage) {
    super(settings.rootPage);
    this.settings = settings;
  }

  get() {
    return this.settings.get().locator(`[data-testid="nc-settings-subtab-visibility"]`);
  }

  async selectTab(tab: 'snapshots-tab' | 'visibility-tab') {
    await this.settings.get().getByTestId(tab).click();
  }

  async clickShowM2MTables() {
    if (isEE()) {
      await this.selectTab('visibility-tab');
    }

    const clickAction = () => this.get().locator('.nc-settings-meta-misc-m2m').first().click();
    await this.waitForResponse({
      uiAction: clickAction,
      requestUrlPathToMatch: 'tables?includeM2M',
      httpMethodsToMatch: ['GET'],
    });
  }

  async clickShowNullEmptyFilters() {
    if (isEE()) {
      await this.selectTab('visibility-tab');
    }

    await this.waitForResponse({
      uiAction: () => this.rootPage.locator('.nc-settings-show-null-and-empty-in-filter').first().click(),
      requestUrlPathToMatch: '/api/v1/db/meta/projects',
      httpMethodsToMatch: ['PATCH'],
    });
  }
}
