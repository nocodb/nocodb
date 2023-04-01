import { expect } from '@playwright/test';
import BasePage from '../../../Base';
import { ToolbarPage } from './index';
import { getTextExcludeIconText } from '../../../../tests/utils/general';

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
    const fieldLocator = await this.get().locator('.nc-sort-field-select').nth(index);
    const fieldText = await getTextExcludeIconText(fieldLocator);
    await expect(fieldText).toBe(column);

    await expect(
      await this.get().locator('.nc-sort-dir-select >> span.ant-select-selection-item').nth(index)
    ).toHaveText(direction);
  }

  async add({ title, ascending, locallySaved }: { title: string; ascending: boolean; locallySaved: boolean }) {
    // open sort menu
    await this.toolbar.clickSort();

    await this.get().locator(`button:has-text("Add Sort Option")`).click();

    // read content of the dropdown
    const col = await this.rootPage.locator('.nc-sort-field-select').last().textContent();
    if (col !== title) {
      await this.rootPage.locator('.nc-sort-field-select').last().click();
      await this.rootPage
        .locator('div.ant-select-dropdown.nc-dropdown-toolbar-field-list')
        .locator(`div[label="${title}"]`)
        .last()
        .click();
    }

    // network request will be triggered only after dir-select is clicked
    //
    // const selectColumn = this.rootPage
    //   .locator('div.ant-select-dropdown.nc-dropdown-toolbar-field-list')
    //   .locator(`div[label="${columnTitle}"]`)
    //   .last()
    //   .click();
    // await this.waitForResponse({
    //   uiAction: selectColumn,
    //   httpMethodsToMatch: isLocallySaved ? ['GET'] : ['POST', 'PATCH'],
    //   requestUrlPathToMatch: isLocallySaved ? `/api/v1/db/public/` : `/sorts`,
    // });
    // await this.toolbar.parent.dashboard.waitForLoaderToDisappear();

    await this.rootPage.locator('.nc-sort-dir-select').last().click();
    const selectSortDirection = () =>
      this.rootPage
        .locator('.nc-dropdown-sort-dir')
        .last()
        .locator('.ant-select-item')
        .nth(ascending ? 0 : 1)
        .click();

    await this.waitForResponse({
      uiAction: selectSortDirection,
      httpMethodsToMatch: ['GET'],
      requestUrlPathToMatch: locallySaved ? `/api/v1/db/public/` : `/api/v1/db/data/noco/`,
    });
    await this.toolbar.parent.dashboard.waitForLoaderToDisappear();
    // close sort menu
    await this.toolbar.clickSort();
    await this.toolbar.parent.waitLoading();
  }

  // todo: remove this opening sort menu logic
  async reset() {
    // open sort menu
    await this.toolbar.clickSort();

    await this.get().locator('.nc-sort-item-remove-btn').last().click();

    // close sort menu
    await this.toolbar.clickSort();
  }

  click({ title }: { title: string }) {
    return this.get().locator(`[data-testid="nc-fields-menu-${title}"]`).locator('input[type="checkbox"]').click();
  }
}
