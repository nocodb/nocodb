import { expect, Locator } from '@playwright/test';
import { SettingsPage } from '.';
import BasePage from '../../Base';

export class AclPage extends BasePage {
  private readonly settings: SettingsPage;

  constructor(settings: SettingsPage) {
    super(settings.rootPage);
    this.settings = settings;
  }

  get() {
    return this.settings.get().locator(`[data-testid="nc-settings-subtab-UI Access Control"]`);
  }

  async toggle({ table, role }: { table: string; role: string }) {
    await this.get().locator(`.nc-acl-${table}-${role}-chkbox`).click();
  }

  async save() {
    await this.waitForResponse({
      uiAction: this.get().locator(`button:has-text("Save")`).click(),
      httpMethodsToMatch: ['POST'],
      requestUrlPathToMatch: '/visibility-rules',
    });
    await this.verifyToast({ message: 'Updated UI ACL for tables successfully' });
  }
}
