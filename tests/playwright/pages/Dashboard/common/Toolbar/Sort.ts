import { expect } from '@playwright/test';
import BasePage from '../../../Base';
import { ToolbarPage } from './index';

export class ToolbarSortPage extends BasePage {
  readonly toolbar: ToolbarPage;

  constructor(toolbar: ToolbarPage) {
    super(toolbar.rootPage);
    this.toolbar = toolbar;
  }

  get() {
    return this.rootPage.locator(`[data-testid="nc-sorts-menu"]`);
  }

  async verify({ index, column, direction }: { index: number; column: string; direction: string }) {
    await expect(this.get().locator('.nc-sort-field-select').nth(index)).toHaveText(column);
    await expect(
      await this.get().locator('.nc-sort-dir-select >> span.ant-select-selection-item').nth(index)
    ).toHaveText(direction);
  }

  async addSort({
    columnTitle,
    isAscending,
    isLocallySaved,
  }: {
    columnTitle: string;
    isAscending: boolean;
    isLocallySaved: boolean;
  }) {
    // open sort menu
    await this.toolbar.clickSort();

    await this.get().locator(`button:has-text("Add Sort Option")`).click();

    await this.rootPage.locator('.nc-sort-field-select').last().click();
    const selectColumn = this.rootPage
      .locator('div.ant-select-dropdown.nc-dropdown-toolbar-field-list')
      .locator(`div[label="${columnTitle}"]`)
      .last()
      .click();
    await this.waitForResponse({
      uiAction: selectColumn,
      httpMethodsToMatch: isLocallySaved ? ['GET'] : ['POST', 'PATCH'],
      requestUrlPathToMatch: isLocallySaved ? `/api/v1/db/public/` : `/sorts`,
    });
    await this.toolbar.parent.dashboard.waitForLoaderToDisappear();

    await this.rootPage.locator('.nc-sort-dir-select').last().click();
    const selectSortDirection = this.rootPage
      .locator('.nc-dropdown-sort-dir')
      .locator('.ant-select-item')
      .nth(isAscending ? 0 : 1)
      .click();

    await this.waitForResponse({
      uiAction: selectSortDirection,
      httpMethodsToMatch: ['GET'],
      requestUrlPathToMatch: isLocallySaved ? `/api/v1/db/public/` : `/api/v1/db/data/noco/`,
    });
    await this.toolbar.parent.dashboard.waitForLoaderToDisappear();
    // close sort menu
    await this.toolbar.clickSort();
    await this.toolbar.parent.waitLoading();
  }

  // todo: remove this opening sort menu logic
  async resetSort() {
    // open sort menu
    await this.toolbar.clickSort();

    await this.get().locator('.nc-sort-item-remove-btn').click();

    // close sort menu
    await this.toolbar.clickSort();
  }

  click({ title }: { title: string }) {
    return this.get().locator(`[data-testid="nc-fields-menu-${title}"]`).locator('input[type="checkbox"]').click();
  }
}
