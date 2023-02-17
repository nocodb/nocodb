import { expect } from '@playwright/test';
import BasePage from '../../../Base';
import { ToolbarPage } from './index';
import { UITypes } from 'nocodb-sdk';

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
      .poll(async () => await this.get().locator('.nc-filter-value-select > input').nth(index).inputValue())
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
    dataType,
  }: {
    columnTitle: string;
    opType: string;
    value?: string;
    isLocallySaved: boolean;
    dataType?: string;
  }) {
    await this.get().locator(`button:has-text("Add Filter")`).first().click();

    const selectedField = await this.rootPage.locator('.nc-filter-field-select').textContent();
    if (selectedField !== columnTitle) {
      await this.rootPage.locator('.nc-filter-field-select').last().click();
      await this.rootPage
        .locator('div.ant-select-dropdown.nc-dropdown-toolbar-field-list')
        .locator(`div[label="${columnTitle}"]:visible`)
        .click();
    }

    // network request will be triggered only after filter value is configured
    //
    // const selectColumn = this.rootPage
    //   .locator('div.ant-select-dropdown.nc-dropdown-toolbar-field-list')
    //   .locator(`div[label="${columnTitle}"]`)
    //   .click();
    // await this.waitForResponse({
    //   uiAction: selectColumn,
    //   httpMethodsToMatch: isLocallySaved ? ['GET'] : ['POST', 'PATCH'],
    //   requestUrlPathToMatch: isLocallySaved ? `/api/v1/db/public/` : `/filters`,
    // });
    // await this.toolbar.parent.dashboard.waitForLoaderToDisappear();

    const selectedOpType = await this.rootPage.locator('.nc-filter-operation-select').textContent();
    if (selectedOpType !== opType) {
      await this.rootPage.locator('.nc-filter-operation-select').click();
      // first() : filter list has >, >=
      await this.rootPage
        .locator('.nc-dropdown-filter-comp-op')
        .locator(`.ant-select-item:has-text("${opType}")`)
        .first()
        .click();
    }
    // if (selectedOpType !== opType) {
    //   await this.rootPage.locator('.nc-filter-operation-select').last().click();
    //   // first() : filter list has >, >=
    //   const selectOpType = this.rootPage
    //     .locator('.nc-dropdown-filter-comp-op')
    //     .locator(`.ant-select-item:has-text("${opType}")`)
    //     .first()
    //     .click();
    //
    //   await this.waitForResponse({
    //     uiAction: selectOpType,
    //     httpMethodsToMatch: isLocallySaved ? ['GET'] : ['POST', 'PATCH'],
    //     requestUrlPathToMatch: isLocallySaved ? `/api/v1/db/public/` : `/filters`,
    //   });
    //   await this.toolbar.parent.dashboard.waitForLoaderToDisappear();
    // }

    // if value field was provided, fill it
    if (value) {
      let fillFilter: any = null;
      switch (dataType) {
        case UITypes.Duration:
          await this.get().locator('.nc-filter-value-select').locator('input').fill(value);
          break;
        case UITypes.Rating:
          await this.get()
            .locator('.ant-rate-star > div')
            .nth(parseInt(value) - 1)
            .click();
          break;
        case UITypes.MultiSelect:
          await this.get().locator('.nc-filter-value-select').click();
          // eslint-disable-next-line no-case-declarations
          const v = value.split(',');
          for (let i = 0; i < v.length; i++) {
            await this.rootPage
              .locator(`.nc-dropdown-multi-select-cell`)
              .locator(`.nc-select-option-MultiSelect-${v[i]}`)
              .click();
          }
          break;
        case UITypes.SingleSelect:
          await this.get().locator('.nc-filter-value-select').click();
          // check if value was an array
          // eslint-disable-next-line no-case-declarations
          const val = value.split(',');
          if (val.length > 1) {
            for (let i = 0; i < val.length; i++) {
              await this.rootPage
                .locator(`.nc-dropdown-multi-select-cell`)
                .locator(`.nc-select-option-SingleSelect-${val[i]}`)
                .click();
            }
          } else {
            await this.rootPage
              .locator(`.nc-dropdown-single-select-cell`)
              .locator(`.nc-select-option-SingleSelect-${value}`)
              .click();
          }
          break;
        default:
          fillFilter = () => this.rootPage.locator('.nc-filter-value-select > input').last().fill(value);
          await this.waitForResponse({
            uiAction: fillFilter,
            httpMethodsToMatch: ['GET'],
            requestUrlPathToMatch: isLocallySaved ? `/api/v1/db/public/` : `/api/v1/db/data/noco/`,
          });
          await this.toolbar.parent.dashboard.waitForLoaderToDisappear();
          await this.toolbar.parent.waitLoading();
          break;
      }
    }
  }

  async reset({ networkValidation = true }: { networkValidation?: boolean } = {}) {
    await this.toolbar.clickFilter();
    if (networkValidation) {
      await this.waitForResponse({
        uiAction: () => this.get().locator('.nc-filter-item-remove-btn').click(),
        httpMethodsToMatch: ['DELETE'],
        requestUrlPathToMatch: '/api/v1/db/meta/filters/',
      });
    } else {
      await this.get().locator('.nc-filter-item-remove-btn').click();
    }
    await this.toolbar.clickFilter();
  }

  async columnOperatorList(param: { columnTitle: string }) {
    await this.get().locator(`button:has-text("Add Filter")`).first().click();

    const selectedField = await this.rootPage.locator('.nc-filter-field-select').textContent();
    if (selectedField !== param.columnTitle) {
      await this.rootPage.locator('.nc-filter-field-select').last().click();
      await this.rootPage
        .locator('div.ant-select-dropdown.nc-dropdown-toolbar-field-list')
        .locator(`div[label="${param.columnTitle}"]:visible`)
        .click();
    }

    await this.rootPage.locator('.nc-filter-operation-select').click();
    const opList = await this.rootPage
      .locator('.nc-dropdown-filter-comp-op')
      .locator(`.ant-select-item > .ant-select-item-option-content`);

    // extract text from each element & put them in an array
    const opListText = [];
    for (let i = 0; i < (await opList.count()); i++) {
      opListText.push(await opList.nth(i).textContent());
    }

    return opListText;
  }
}
