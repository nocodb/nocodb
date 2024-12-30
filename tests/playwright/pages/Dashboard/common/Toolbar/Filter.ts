import { expect } from '@playwright/test';
import BasePage from '../../../Base';
import { ToolbarPage } from './index';
import { UITypes } from 'nocodb-sdk';
import { getTextExcludeIconText } from '../../../../tests/utils/general';

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
    const fieldLocator = this.get().locator('.nc-filter-field-select').nth(index);
    const fieldText = await getTextExcludeIconText(fieldLocator);
    expect(fieldText).toBe(column);

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

  async clickAddFilter() {
    await this.get().getByTestId('add-filter').first().click();
  }

  // can reuse code for addFilterGroup and addFilter
  // support for subOperation & datatype specific filter operations not supported yet
  async addFilterGroup({
    title,
    operation,
    _subOperation: _subOperation,
    value,
    _locallySaved: _locallySaved = false,
    _dataType: _dataType,
    _openModal: _openModal = false,
    _skipWaitingResponse: _skipWaitingResponse = false, // used for undo (single request, less stable)
    filterGroupIndex = 0,
    filterLogicalOperator = 'AND',
  }: {
    title: string;
    operation: string;
    _subOperation?: string; // for date datatype
    value?: string;
    _locallySaved?: boolean;
    _dataType?: string;
    _openModal?: boolean;
    _skipWaitingResponse?: boolean;
    filterGroupIndex?: number;
    filterLogicalOperator?: string;
  }) {
    await this.get().getByTestId('add-filter-group').last().click();
    const filterDropdown = this.get().locator('.menu-filter-dropdown').nth(filterGroupIndex);
    await filterDropdown.waitFor({ state: 'visible' });
    const ADD_BUTTON_SELECTOR = `span:has-text("add")`;
    const FILTER_GROUP_SUB_MENU_SELECTOR = `.nc-dropdown-filter-group-sub-menu`;
    const ADD_FILTER_SELECTOR = `[data-testid="add-filter-menu"].nc-menu-item`;

    await filterDropdown.locator(ADD_BUTTON_SELECTOR).first().click();
    const filterGroupSubMenu = this.rootPage.locator(FILTER_GROUP_SUB_MENU_SELECTOR).last();
    await filterGroupSubMenu.waitFor({ state: 'visible' });
    await filterGroupSubMenu.locator(ADD_FILTER_SELECTOR).first().click();
    const selectField = filterDropdown.locator('.nc-filter-field-select').last();
    const selectOperation = filterDropdown.locator('.nc-filter-operation-select').last();
    const selectValue = filterDropdown.locator('.nc-filter-value-select > input').last();

    await selectField.waitFor({ state: 'visible' });
    await selectField.click();
    const fieldDropdown = this.rootPage
      .locator('div.ant-select-dropdown.nc-dropdown-toolbar-field-list')
      .last()
      .locator(`div[label="${title}"]:visible`);
    await fieldDropdown.waitFor({ state: 'visible' });
    await fieldDropdown.click();

    await selectOperation.waitFor({ state: 'visible' });
    await selectOperation.click();
    const operationDropdown = this.rootPage
      .locator('div.ant-select-dropdown.nc-dropdown-filter-comp-op')
      .last()
      .locator(`.ant-select-item:has-text("${operation}")`);
    await operationDropdown.waitFor({ state: 'visible' });
    await operationDropdown.click();

    await selectValue.waitFor({ state: 'visible' });
    await selectValue.fill(value);

    if (filterGroupIndex) {
      if (filterLogicalOperator === 'OR') {
        const logicalButton = this.rootPage.locator('div.flex.nc-filter-logical-op').nth(filterGroupIndex - 1);
        await logicalButton.waitFor({ state: 'visible' });
        await logicalButton.click();

        const logicalDropdown = this.rootPage.locator('div.ant-select-dropdown.nc-dropdown-filter-logical-op-group');
        await logicalDropdown.waitFor({ state: 'visible' });
        await logicalDropdown.locator(`.ant-select-item:has-text("${filterLogicalOperator}")`).click();
      }
    }
  }

  async add({
    title,
    operation,
    subOperation,
    value,
    locallySaved = false,
    dataType,
    openModal = false,
    // TODO: we do not wait for api response as there are cases where new filter will not be saved
    skipWaitingResponse = false, // used for undo (single request, less stable)
  }: {
    title: string;
    operation: string;
    subOperation?: string; // for date datatype
    value?: string;
    locallySaved?: boolean;
    dataType?: string;
    openModal?: boolean;
    skipWaitingResponse?: boolean;
  }) {
    if (!openModal) {
      await this.get().getByTestId('add-filter').first().click();
    }

    const filterCount = await this.get().locator('.nc-filter-wrapper').count();

    const selectedField = await getTextExcludeIconText(
      this.rootPage.locator('.nc-filter-field-select .ant-select-selection-item').first()
    );

    if (selectedField !== title) {
      await this.rootPage.locator('.nc-filter-field-select').last().click();

      if (skipWaitingResponse || filterCount === 1) {
        await this.rootPage
          .locator('div.ant-select-dropdown.nc-dropdown-toolbar-field-list')
          .locator(`div[label="${title}"]:visible`)
          .click()
          .then(() => {});
        await this.rootPage.waitForTimeout(350);
      } else {
        await this.waitForResponse({
          uiAction: async () =>
            await this.rootPage
              .locator('div.ant-select-dropdown.nc-dropdown-toolbar-field-list')
              .locator(`div[label="${title}"]:visible`)
              .click(),
          httpMethodsToMatch: ['GET'],
          requestUrlPathToMatch: locallySaved ? `/api/v1/db/public/` : `/api/v1/db/data/noco/`,
        });
      }
    }

    const selectedOpType = await getTextExcludeIconText(this.rootPage.locator('.nc-filter-operation-select').last());
    if (selectedOpType !== operation) {
      await this.rootPage.locator('.nc-filter-operation-select').last().click();
      // first() : filter list has >, >=

      if (skipWaitingResponse || filterCount === 1) {
        await this.rootPage
          .locator('.nc-dropdown-filter-comp-op')
          .locator(`.ant-select-item:has-text("${operation}")`)
          .first()
          .click()
          .then(() => {});
        await this.rootPage.waitForTimeout(350);
      } else {
        await this.waitForResponse({
          uiAction: async () =>
            await this.rootPage
              .locator('.nc-dropdown-filter-comp-op')
              .locator(`.ant-select-item:has-text("${operation}")`)
              .first()
              .click(),
          httpMethodsToMatch: ['GET'],
          requestUrlPathToMatch: locallySaved ? `/api/v1/db/public/` : `/api/v1/db/data/noco/`,
        });
      }
    }

    // subtype for date
    if (dataType === UITypes.Date && subOperation) {
      const selectedSubType = await getTextExcludeIconText(this.rootPage.locator('.nc-filter-sub_operation-select'));
      if (selectedSubType !== subOperation) {
        await this.rootPage.locator('.nc-filter-sub_operation-select').click();
        // first() : filter list has >, >=

        if (skipWaitingResponse || filterCount === 1) {
          await this.rootPage
            .locator('.nc-dropdown-filter-comp-sub-op')
            .locator(`.ant-select-item:has-text("${subOperation}")`)
            .first()
            .click();
          await this.rootPage.waitForTimeout(350);
        } else {
          await this.waitForResponse({
            uiAction: async () =>
              await this.rootPage
                .locator('.nc-dropdown-filter-comp-sub-op')
                .locator(`.ant-select-item:has-text("${subOperation}")`)
                .first()
                .click(),
            httpMethodsToMatch: ['GET'],
            requestUrlPathToMatch: locallySaved ? `/api/v1/db/public/` : `/api/v1/db/data/noco/`,
          });
        }
      }
    }

    // if value field was provided, fill it
    if (value) {
      let fillFilter: any = null;
      switch (dataType) {
        case UITypes.Year:
          await this.get().locator('.nc-filter-value-select').click();
          await this.rootPage.locator(`.nc-picker-year:visible`).waitFor();
          await this.rootPage.locator('.nc-year-picker-btn:visible').waitFor();

          await this.get().locator('.nc-filter-value-select .nc-year-input').fill(value);
          await this.rootPage.keyboard.press('Enter');
          break;
        case UITypes.Time:
          // eslint-disable-next-line no-case-declarations
          const timeInput = this.get().locator('.nc-filter-value-select').locator('.nc-time-input');
          await timeInput.click();
          // eslint-disable-next-line no-case-declarations
          const dropdown = this.rootPage.locator('.nc-picker-time.active');
          await dropdown.waitFor({ state: 'visible' });

          await timeInput.fill(value);
          await this.rootPage.keyboard.press('Enter');

          await dropdown.waitFor({ state: 'hidden' });

          break;
        case UITypes.Date:
          if (subOperation === 'exact date') {
            await this.get().locator('.nc-filter-value-select .nc-date-input').click();
            const dropdown = this.rootPage.locator(`.nc-picker-date.active`);
            await dropdown.waitFor({ state: 'visible' });
            const dateItem = dropdown.locator('.nc-date-item').getByText(value);
            await dateItem.waitFor();
            await dateItem.scrollIntoViewIfNeeded();
            await dateItem.hover();

            if (skipWaitingResponse) {
              await dateItem.click();
              await dropdown.waitFor({ state: 'hidden' });
              await this.rootPage.waitForTimeout(350);
            } else {
              await this.waitForResponse({
                uiAction: async () => {
                  await dateItem.click();
                  await dropdown.waitFor({ state: 'hidden' });
                },
                httpMethodsToMatch: ['GET'],
                requestUrlPathToMatch: locallySaved ? `/api/v1/db/public/` : `/api/v1/db/data/noco/`,
              });
            }
          } else {
            fillFilter = () => this.rootPage.locator('.nc-filter-value-select > input').last().fill(value);
            if (skipWaitingResponse) {
              await fillFilter();
              await this.rootPage.waitForTimeout(350);
            } else {
              await this.waitForResponse({
                uiAction: fillFilter,
                httpMethodsToMatch: ['GET'],
                requestUrlPathToMatch: locallySaved ? `/api/v1/db/public/` : `/api/v1/db/data/noco/`,
              });
            }
            await this.toolbar.parent.dashboard.waitForLoaderToDisappear();
            await this.toolbar.parent.waitLoading();
          }
          break;
        case UITypes.Duration:
          if (skipWaitingResponse) {
            await this.get().locator('.nc-filter-value-select').locator('input').fill(value);
            await this.get().locator('.nc-filter-value-select').locator('input').press('Enter');
            await this.rootPage.waitForTimeout(350);
          } else {
            await this.waitForResponse({
              uiAction: async () => await this.get().locator('.nc-filter-value-select').locator('input').fill(value),
              httpMethodsToMatch: ['GET'],
              requestUrlPathToMatch: locallySaved ? `/api/v1/db/public/` : `/api/v1/db/data/noco/`,
            });
          }
          break;
        case UITypes.Rating:
          await this.get()
            .locator('.ant-rate-star > div')
            .nth(parseInt(value) - 1)
            .click();
          break;
        case UITypes.MultiSelect:
          await this.get().locator('.nc-filter-value-select').locator('.ant-select-arrow').click({ force: true });
          // eslint-disable-next-line no-case-declarations
          const v = value.split(',');
          for (let i = 0; i < v.length; i++) {
            if (skipWaitingResponse) {
              await this.rootPage
                .locator(`.nc-dropdown-multi-select-cell`)
                .locator(`[data-testid="select-option-MultiSelect-filter"].nc-select-option-MultiSelect-${v[i]}`)
                .click();
            } else {
              await this.waitForResponse({
                uiAction: async () =>
                  await this.rootPage
                    .locator(`.nc-dropdown-multi-select-cell`)
                    .locator(`[data-testid="select-option-MultiSelect-filter"].nc-select-option-MultiSelect-${v[i]}`)
                    .click(),
                httpMethodsToMatch: ['GET'],
                requestUrlPathToMatch: `/api/v1/db/data/noco/`,
              });
            }
          }
          break;
        case UITypes.SingleSelect:
          // for single select field, the drop select arrow is visible only for some operations
          if ((await this.get().locator('.nc-filter-value-select').locator('.ant-select-arrow').count()) > 0) {
            await this.get().locator('.nc-filter-value-select').locator('.ant-select-arrow').click({ force: true });
          } else {
            await this.get().locator('.nc-filter-value-select').click({ force: true });
          }
          // check if value was an array
          // eslint-disable-next-line no-case-declarations
          const val = value.split(',');
          if (val.length > 1) {
            for (let i = 0; i < val.length; i++) {
              if (skipWaitingResponse) {
                await this.rootPage
                  .locator(`.nc-dropdown-multi-select-cell`)
                  .locator(`.nc-select-option-SingleSelect-${val[i]}`)
                  .click();
              } else {
                await this.waitForResponse({
                  uiAction: async () =>
                    await this.rootPage
                      .locator(`.nc-dropdown-multi-select-cell`)
                      .locator(`.nc-select-option-SingleSelect-${val[i]}`)
                      .click(),
                  httpMethodsToMatch: ['GET'],
                  requestUrlPathToMatch: `/api/v1/db/data/noco/`,
                });
              }
            }
          } else {
            if (skipWaitingResponse) {
              await this.rootPage
                .locator(`.nc-dropdown-single-select-cell`)
                .locator(`.nc-select-option-${title}-${value}`)
                .click();
            } else {
              await this.waitForResponse({
                uiAction: async () =>
                  await this.rootPage
                    .locator(`.nc-dropdown-single-select-cell`)
                    .locator(`.nc-select-option-${title}-${value}`)
                    .click(),
                httpMethodsToMatch: ['GET'],
                requestUrlPathToMatch: `/api/v1/db/data/noco/`,
              });
            }
          }
          break;
        case UITypes.User:
          if (!['is blank', 'is not blank'].includes(operation)) {
            await this.get().locator('.nc-filter-value-select').locator('.ant-select-arrow').click({ force: true });

            await this.rootPage.locator(`.nc-dropdown-user-select-cell.active`).waitFor({ state: 'visible' });

            const v = value.split(',');
            for (let i = 0; i < v.length; i++) {
              const selectUser = () =>
                this.rootPage
                  .locator(`.nc-dropdown-user-select-cell.active`)
                  .locator(`[data-testid="select-option-User-filter"]:has-text("${v[i]}")`)
                  .click();
              await this.waitForResponse({
                uiAction: selectUser,
                httpMethodsToMatch: ['GET'],
                requestUrlPathToMatch: `/api/v1/db/data/noco/`,
              });
            }
          }
          break;

        default:
          fillFilter = async () => {
            await this.get().locator('.nc-filter-value-select > input').last().clear({ force: true });
            return this.get().locator('.nc-filter-value-select > input').last().fill(value);
          };
          if (!skipWaitingResponse) {
            await this.waitForResponse({
              uiAction: fillFilter,
              httpMethodsToMatch: ['GET'],
              requestUrlPathToMatch: locallySaved ? `/api/v1/db/public/` : `/api/v1/db/data/noco/`,
            });
            await this.toolbar.parent.dashboard.waitForLoaderToDisappear();
            await this.toolbar.parent.waitLoading();
          } else {
            await fillFilter();
          }
          break;
      }
    }
  }

  async reset({ networkValidation = true }: { networkValidation?: boolean } = {}) {
    await this.toolbar.clickFilter();
    if (networkValidation) {
      await this.waitForResponse({
        uiAction: async () => await this.get().locator('.nc-filter-item-remove-btn').click(),
        httpMethodsToMatch: ['DELETE'],
        requestUrlPathToMatch: '/api/v1/db/meta/filters/',
      });
    } else {
      await this.get().locator('.nc-filter-item-remove-btn').click();
    }
    // TODO: Filter reset await not working all the time

    await this.rootPage.waitForTimeout(650);
    await this.toolbar.clickFilter();
  }

  async remove({ networkValidation = true }: { networkValidation?: boolean } = {}) {
    if (networkValidation) {
      await this.waitForResponse({
        uiAction: async () => await this.get().locator('.nc-filter-item-remove-btn').click(),
        httpMethodsToMatch: ['DELETE'],
        requestUrlPathToMatch: '/api/v1/db/meta/filters/',
      });
    } else {
      await this.get().locator('.nc-filter-item-remove-btn').click();
    }
  }

  async columnOperatorList(param: { columnTitle: string }) {
    await this.get().getByTestId('add-filter').first().click();

    const selectedField = await this.rootPage.locator('.nc-filter-field-select').textContent();
    if (selectedField !== param.columnTitle) {
      await this.rootPage.locator('.nc-filter-field-select').last().click();
      await this.rootPage
        .locator('div.ant-select-dropdown.nc-dropdown-toolbar-field-list')
        .locator(`div[label="${param.columnTitle}"]:visible`)
        .click();
    }

    await this.rootPage.locator('.nc-filter-operation-select').click();
    const opList = this.rootPage
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
