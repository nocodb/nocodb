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
  async toggle({
    title,
    isLocallySaved,
    validateResponse = true,
  }: {
    title: string;
    isLocallySaved?: boolean;
    validateResponse?: boolean;
  }) {
    await this.toolbar.clickFields();

    // hack
    await this.rootPage.waitForTimeout(100);

    const toggleColumn = () =>
      this.get().locator(`[data-testid="nc-fields-menu-${title}"]`).locator('.nc-switch').click();

    if (validateResponse) {
      await this.waitForResponse({
        uiAction: toggleColumn,
        requestUrlPathToMatch: isLocallySaved ? '/api/v1/db/public/' : '/api/v1/db/data/noco/',
        httpMethodsToMatch: ['GET'],
      });
    } else {
      await toggleColumn();
    }

    await this.toolbar.parent.dashboard.waitForLoaderToDisappear();
    await this.toolbar.clickFields();
  }

  async verify({ title, checked }: { title: string; checked?: boolean }) {
    const checkbox = this.get().locator(`[data-testid="nc-fields-menu-${title}"]`).locator('.nc-switch');

    if (checked) {
      await expect(checkbox).toBeChecked();
    } else if (checked === false) {
      await expect(checkbox).not.toBeChecked();
    }
  }

  async click({ title, isLocallySaved }: { title: string; isLocallySaved?: boolean }) {
    await this.waitForResponse({
      uiAction: () => this.get().locator(`[data-testid="nc-fields-menu-${title}"]`).locator('.nc-switch').click(),
      requestUrlPathToMatch: isLocallySaved ? '/api/v1/db/public/' : '/api/v1/db/data/noco/',
      httpMethodsToMatch: ['GET'],
    });
    await this.toolbar.parent.waitLoading();
  }

  async toggleShowAllFields({ isLocallySaved }: { isLocallySaved?: boolean } = {}) {
    await this.toolbar.clickFields();
    await this.waitForResponse({
      uiAction: () => this.get().locator(`.nc-fields-show-all-fields`).click(),
      requestUrlPathToMatch: isLocallySaved ? '/api/v1/db/public/' : '/api/v1/db/data/noco/',
      httpMethodsToMatch: ['GET'],
      timeout: 10000,
    });
    await this.toolbar.clickFields();
  }

  // async showAll({ isLocallySaved }: { isLocallySaved?: boolean } = {}) {
  //   await this.toolbar.clickFields();
  //   await this.waitForResponse({
  //     uiAction: () => this.get().locator(`button.nc-switch`).first().click(),
  //     requestUrlPathToMatch: isLocallySaved ? '/api/v1/db/public/' : '/api/v1/db/data/noco/',
  //     httpMethodsToMatch: ['GET'],
  //   });
  //   await this.toolbar.clickFields();
  // }

  async toggleShowSystemFields({ isLocallySaved }: { isLocallySaved?: boolean } = {}) {
    await this.toolbar.clickFields();
    await this.waitForResponse({
      uiAction: async () => await this.get().locator(`.nc-fields-show-system-fields`).click(),
      requestUrlPathToMatch: isLocallySaved ? '/api/v1/db/public/' : '/api/v1/db/data/noco/',
      httpMethodsToMatch: ['GET'],
    });
    await this.toolbar.clickFields();
  }

  async getFieldsTitles() {
    const fields: string[] = await this.rootPage.locator(`.nc-grid-header .name`).allTextContents();
    return fields;
  }

  async dragDropFields(param: { from: number; to: number }) {
    await this.toolbar.clickFields();
    const { from, to } = param;
    const [fromStack, toStack] = await Promise.all([
      this.get().locator(`.cursor-move`).nth(from),
      this.get().locator(`.cursor-move`).nth(to),
    ]);

    await fromStack.dragTo(toStack);
    await this.toolbar.clickFields();
  }
}
