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
    checked,
  }: {
    title: string;
    isLocallySaved?: boolean;
    validateResponse?: boolean;
    checked?: boolean;
  }) {
    await this.toolbar.clickFields();

    // hack
    await this.rootPage.waitForTimeout(100);

    // toggle only if input checked value is not equal to given checked value
    await this.get().locator(`[data-testid="nc-fields-menu-${title}"]`).locator('.nc-switch').scrollIntoViewIfNeeded();
    const isChecked = await this.get()
      .locator(`[data-testid="nc-fields-menu-${title}"]`)
      .locator('.nc-switch')
      .isChecked();
    if (checked !== undefined) {
      if ((checked && isChecked) || (!checked && !isChecked)) {
        await this.toolbar.clickFields();
        return;
      }
    }

    if (isChecked === true) {
      // disable response validation for hide field
      validateResponse = false;
    }

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
    // hide field doesn't trigger an un-solicited update from backend
    // await this.waitForResponse({
    //   uiAction: () => this.get().locator(`[data-testid="nc-fields-menu-${title}"]`).locator('.nc-switch').click(),
    //   requestUrlPathToMatch: isLocallySaved ? '/api/v1/db/public/' : '/api/v1/db/data/noco/',
    //   httpMethodsToMatch: ['GET'],
    // });
    await this.get().locator(`[data-testid="nc-fields-menu-${title}"]`).locator('.nc-switch').click();
    await this.toolbar.parent.waitLoading();
  }

  async toggleShowAllFields({ isLocallySaved, isKanban }: { isLocallySaved?: boolean, isKanban?: boolean } = {}) {
    await this.toolbar.clickFields();
    await this.waitForResponse({
      uiAction: () => this.get().locator(`.nc-fields-toggle-show-all-fields`).click(),
      requestUrlPathToMatch: isLocallySaved ? '/api/v1/db/public/' : '/api/v1/db/data/noco/',
      httpMethodsToMatch: ['GET'],
      timeout: 30000, // for Kanban, show all fields can take a long time
    });

    // TODO: fix this (Show all for kanban takes time to load)
    if (isKanban) await new Promise((r) => setTimeout(r, 2000));

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
