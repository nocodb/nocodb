import { expect } from '@playwright/test';
import BasePage from '../../../Base';
import { ToolbarPage } from './index';
import { getTextExcludeIconText } from '../../../../tests/utils/general';

export class ToolbarGroupByPage extends BasePage {
  readonly toolbar: ToolbarPage;

  constructor(toolbar: ToolbarPage) {
    super(toolbar.rootPage);
    this.toolbar = toolbar;
  }

  get() {
    return this.rootPage.locator(`.nc-group-by-menu-btn`);
  }

  async verify({ index, column, direction }: { index: number; column: string; direction: string }) {
    const fieldLocator = this.get().locator('.nc-sort-field-select').nth(index);
    const fieldText = await getTextExcludeIconText(fieldLocator);
    expect(fieldText).toBe(column);

    await expect(this.get().locator('.nc-sort-dir-select >> span.ant-select-selection-item').nth(index)).toHaveText(
      direction
    );
  }

  async reset() {
    const groupByCount = await this.rootPage.locator('.nc-group-by-item-remove-btn').count();
    for (let i = groupByCount - 1; i > -1; i--) {
      await this.rootPage.locator('.nc-group-by-item-remove-btn').nth(i).click();
    }
  }

  async update({ index, title, ascending }: { index: number; title: string; ascending: boolean }) {
    // Update the Column and Direction of the Group By at the given index
    await this.rootPage.locator('.nc-sort-field-select').nth(index).click();
    await this.rootPage
      .locator('div.ant-select-dropdown.nc-dropdown-toolbar-field-list')
      .locator(`div[label="${title}"]`)
      .last()
      .click();
    await this.rootPage.locator('.nc-sort-dir-select').nth(index).click();
    await this.rootPage
      .locator('.nc-dropdown-sort-dir')
      .last()
      .locator('.ant-select-item')
      .nth(ascending ? 0 : 1)
      .click();
  }

  async add({ title, ascending, locallySaved }: { title: string; ascending: boolean; locallySaved: boolean }) {
    const addGroupBtn = this.toolbar.rootPage.locator(`.nc-add-group-btn`);
    if (!(await addGroupBtn.isDisabled())) {
      await addGroupBtn.click();
    }
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
  }

  async remove({ index }: { index: number }) {
    await this.rootPage.locator('.nc-group-by-item-remove-btn').nth(index).click();
  }
}
