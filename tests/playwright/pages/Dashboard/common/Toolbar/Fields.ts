import { expect } from '@playwright/test';
import BasePage from '../../../Base';
import { ToolbarPage } from './index';

export class ToolbarFieldsPage extends BasePage {
  readonly toolbar: ToolbarPage;

  constructor(toolbar: ToolbarPage) {
    super(toolbar.rootPage);
    this.toolbar = toolbar;
  }

  get() {
    return this.rootPage.locator(`[data-testid="nc-fields-menu"]`);
  }

  // todo: Click and toggle are similar method. Remove one of them
  async toggle({ title, isLocallySaved }: { title: string; isLocallySaved?: boolean }) {
    await this.toolbar.clickFields();
    const toggleColumn = this.get()
      .locator(`[data-testid="nc-fields-menu-${title}"]`)
      .locator('input[type="checkbox"]')
      .click();

    await this.waitForResponse({
      uiAction: toggleColumn,
      requestUrlPathToMatch: isLocallySaved ? '/api/v1/db/public/' : '/api/v1/db/data/noco/',
      httpMethodsToMatch: ['GET'],
    });
    await this.toolbar.parent.dashboard.waitForLoaderToDisappear();
    await this.toolbar.clickFields();
  }

  async verify({ title, checked }: { title: string; checked: boolean }) {
    const checkbox = this.get().locator(`[data-testid="nc-fields-menu-${title}"]`).locator('input[type="checkbox"]');

    if (checked) {
      await expect(checkbox).toBeChecked();
    } else {
      await expect(checkbox).not.toBeChecked();
    }
  }

  async click({ title, isLocallySaved }: { title: string; isLocallySaved?: boolean }) {
    await this.waitForResponse({
      uiAction: this.get().locator(`[data-testid="nc-fields-menu-${title}"]`).locator('input[type="checkbox"]').click(),
      requestUrlPathToMatch: isLocallySaved ? '/api/v1/db/public/' : '/api/v1/db/data/noco/',
      httpMethodsToMatch: ['GET'],
    });
    await this.toolbar.parent.waitLoading();
  }

  async hideAll({ isLocallySaved }: { isLocallySaved?: boolean } = {}) {
    await this.toolbar.clickFields();
    await this.waitForResponse({
      uiAction: this.get().locator(`button:has-text("Hide all")`).click(),
      requestUrlPathToMatch: isLocallySaved ? '/api/v1/db/public/' : '/api/v1/db/data/noco/',
      httpMethodsToMatch: ['GET'],
    });
    await this.toolbar.clickFields();
  }

  async showAll({ isLocallySaved }: { isLocallySaved?: boolean } = {}) {
    await this.toolbar.clickFields();
    await this.waitForResponse({
      uiAction: this.get().locator(`button:has-text("Show all")`).click(),
      requestUrlPathToMatch: isLocallySaved ? '/api/v1/db/public/' : '/api/v1/db/data/noco/',
      httpMethodsToMatch: ['GET'],
    });
    await this.toolbar.clickFields();
  }

  async toggleShowSystemFields({ isLocallySaved }: { isLocallySaved?: boolean } = {}) {
    await this.toolbar.clickFields();
    await this.waitForResponse({
      uiAction: this.get().locator(`.nc-fields-show-system-fields`).click(),
      requestUrlPathToMatch: isLocallySaved ? '/api/v1/db/public/' : '/api/v1/db/data/noco/',
      httpMethodsToMatch: ['GET'],
    });
    await this.toolbar.clickFields();
  }
}
