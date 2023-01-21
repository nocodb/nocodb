import { expect } from '@playwright/test';
import BasePage from '../../../Base';
import { ToolbarPage } from './index';

export class ToolbarFilterPage extends BasePage {
  readonly toolbar: ToolbarPage;

  constructor(toolbar: ToolbarPage) {
    super(toolbar.rootPage);
    this.toolbar = toolbar;
  }

  get() {
    return this.rootPage.locator(`[data-testid="nc-filter-menu"]`);
  }

  async verify({ index, column, operator, value }: { index: number; column: string; operator: string; value: string }) {
    await expect(this.get().locator('.nc-filter-field-select').nth(index)).toHaveText(column);
    await expect(this.get().locator('.nc-filter-operation-select').nth(index)).toHaveText(operator);
    await expect
      .poll(async () => await this.get().locator('input.nc-filter-value-select').nth(index).inputValue())
      .toBe(value);
  }

  async verifyFilter({ title }: { title: string }) {
    await expect(
      this.get().locator(`[data-testid="nc-fields-menu-${title}"]`).locator('input[type="checkbox"]')
    ).toBeChecked();
  }

  async add({
    columnTitle,
    opType,
    value,
    isLocallySaved,
  }: {
    columnTitle: string;
    opType: string;
    value?: string;
    isLocallySaved: boolean;
  }) {
    await this.get().locator(`button:has-text("Add Filter")`).first().click();

    await this.rootPage.locator('.nc-filter-field-select').last().click();
    const selectColumn = this.rootPage
      .locator('div.ant-select-dropdown.nc-dropdown-toolbar-field-list')
      .locator(`div[label="${columnTitle}"][aria-selected="false"]:visible`)
      .click();
    await this.waitForResponse({
      uiAction: selectColumn,
      httpMethodsToMatch: isLocallySaved ? ['GET'] : ['POST', 'PATCH'],
      requestUrlPathToMatch: isLocallySaved ? `/api/v1/db/public/` : `/filters`,
    });
    await this.toolbar.parent.dashboard.waitForLoaderToDisappear();

    const selectedOpType = await this.rootPage.locator('.nc-filter-operation-select').textContent();
    if (selectedOpType !== opType) {
      await this.rootPage.locator('.nc-filter-operation-select').last().click();
      const selectOpType = this.rootPage
        .locator('.nc-dropdown-filter-comp-op')
        .locator(`.ant-select-item:has-text("${opType}")`)
        .click();

      await this.waitForResponse({
        uiAction: selectOpType,
        httpMethodsToMatch: isLocallySaved ? ['GET'] : ['POST', 'PATCH'],
        requestUrlPathToMatch: isLocallySaved ? `/api/v1/db/public/` : `/filters`,
      });
      await this.toolbar.parent.dashboard.waitForLoaderToDisappear();
    }

    // if value field was provided, fill it
    if (value) {
      const fillFilter = this.rootPage.locator('.nc-filter-value-select').last().fill(value);
      await this.waitForResponse({
        uiAction: fillFilter,
        httpMethodsToMatch: ['GET'],
        requestUrlPathToMatch: isLocallySaved ? `/api/v1/db/public/` : `/api/v1/db/data/noco/`,
      });
      await this.toolbar.parent.dashboard.waitForLoaderToDisappear();
      await this.toolbar.parent.waitLoading();
    }
  }

  async reset() {
    await this.toolbar.clickFilter();
    await this.waitForResponse({
      uiAction: this.get().locator('.nc-filter-item-remove-btn').click(),
      httpMethodsToMatch: ['DELETE'],
      requestUrlPathToMatch: '/api/v1/db/meta/filters/',
    });
    await this.toolbar.clickFilter();
  }
}
