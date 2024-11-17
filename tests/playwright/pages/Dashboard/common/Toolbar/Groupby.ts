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
    return this.rootPage.locator(`[data-testid="nc-group-by-menu"]`);
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
    // open group-by menu
    await this.toolbar.clickGroupBy();

    const groupByCount = await this.rootPage.locator('.nc-group-by-item-remove-btn').count();
    for (let i = groupByCount - 1; i > -1; i--) {
      await this.rootPage.locator('.nc-group-by-item-remove-btn').nth(i).click();
    }

    // close group-by menu
    await this.toolbar.clickGroupBy();
    await this.toolbar.parent.waitLoading();
  }

  async update({ index, title, ascending }: { index: number; title: string; ascending: boolean }) {
    await this.toolbar.clickGroupBy();

    // Update the Column and Direction of the Group By at the given index
    await this.rootPage.locator('.nc-sort-field-select').nth(index).click();
    await this.rootPage
      .locator('div.ant-select-dropdown.nc-dropdown-toolbar-field-list')
      .locator(`div[label="${title}"]`)
      .last()
      .click();

    //kludge: wait for rendering to stabilize
    await this.rootPage.waitForTimeout(1000);

    await this.rootPage.locator('.nc-sort-dir-select').nth(index).waitFor({ state: 'visible' });
    await this.rootPage.locator('.nc-sort-dir-select').nth(index).click({ force: true });
    await this.rootPage
      .locator('.nc-dropdown-sort-dir')
      .last()
      .locator('.ant-select-item')
      .nth(ascending ? 0 : 1)
      .click();

    // await this.toolbar.parent.dashboard.waitForLoaderToDisappear();
    // close group-by menu
    await this.toolbar.clickGroupBy();
    await this.toolbar.parent.waitLoading();
  }

  async add({ title, ascending, locallySaved }: { title: string; ascending: boolean; locallySaved: boolean }) {
    // open group-by menu
    await this.toolbar.clickGroupBy();

    // Check if create group-by modal is open or group-by list is open
    let isGroupByListOpen = false;
    for (let i = 0; i < 3; i++) {
      const groupByList = this.rootPage.locator('.nc-group-by-list');
      if (await groupByList.isVisible()) {
        isGroupByListOpen = true;
        break;
      }

      const searchInput = this.rootPage.locator('.nc-group-by-create-modal');
      if (await searchInput.isVisible()) {
        isGroupByListOpen = false;
        break;
      }

      await this.rootPage.waitForTimeout(150);
    }

    if (isGroupByListOpen) {
      await this.get().locator('button:has-text("New Subgroup")').click();
    }

    const regexTitle = new RegExp(`^${title}`);

    await this.rootPage
      .locator('.nc-group-by-create-modal')
      .locator('.nc-group-by-column-search-item', { hasText: regexTitle })
      .scrollIntoViewIfNeeded();

    // select column
    const selectColumn = async () =>
      await this.rootPage
        .locator('.nc-group-by-create-modal')
        .locator('.nc-group-by-column-search-item', { hasText: regexTitle })
        .click({ force: true });

    await this.waitForResponse({
      uiAction: selectColumn,
      httpMethodsToMatch: ['GET'],
      requestUrlPathToMatch: locallySaved ? `/api/v1/db/public/` : `/api/v1/db/data/noco/`,
    });

    await this.rootPage.locator('.nc-sort-dir-select').last().click();
    const selectSortDirection = () =>
      this.rootPage
        .locator('.nc-dropdown-sort-dir')
        .last()
        .locator('.ant-select-item')
        .nth(ascending ? 0 : 1)
        .click();

    const selectedSortDirection = await this.rootPage.locator('.nc-sort-dir-select').last().textContent();

    if ((ascending && selectedSortDirection != 'A → Z') || (!ascending && selectedSortDirection != 'Z → A')) {
      await this.waitForResponse({
        uiAction: selectSortDirection,
        httpMethodsToMatch: ['GET'],
        requestUrlPathToMatch: locallySaved ? `/api/v1/db/public/` : `/api/v1/db/data/noco/`,
      });
    }

    // await this.toolbar.parent.dashboard.waitForLoaderToDisappear();

    // close group-by menu
    await this.toolbar.clickGroupBy();
    await this.toolbar.parent.waitLoading();
  }

  async remove({ index }: { index: number }) {
    // open group-by menu
    await this.toolbar.clickGroupBy();

    await this.waitForResponse({
      uiAction: () => this.rootPage.locator('.nc-group-by-item-remove-btn').nth(index).click(),
      requestUrlPathToMatch: '/api/v1/db/data/noco',
      httpMethodsToMatch: ['GET'],
    });

    // close group-by menu
    await this.toolbar.clickGroupBy();
    await this.toolbar.parent.waitLoading();
  }
}
