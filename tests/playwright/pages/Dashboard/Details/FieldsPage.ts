// Fields

import BasePage from '../../Base';
import { expect, Locator } from '@playwright/test';
import { DetailsPage } from './index';

export class FieldsPage extends BasePage {
  readonly detailsPage: DetailsPage;

  readonly searchFieldInput: Locator;
  readonly addNewFieldButton: Locator;
  readonly resetFieldChangesButton: Locator;
  readonly saveChangesButton: Locator;
  readonly addOrEditColumn: Locator;
  readonly fieldListWrapper: Locator;

  constructor(details: DetailsPage) {
    super(details.rootPage);
    this.detailsPage = details;
    this.searchFieldInput = this.get().getByTestId('nc-field-search-input');
    this.addNewFieldButton = this.get().getByTestId('nc-field-add-new');
    this.resetFieldChangesButton = this.get().getByTestId('nc-field-reset');
    this.saveChangesButton = this.get().getByTestId('nc-field-save-changes');
    this.addOrEditColumn = this.get().getByTestId('add-or-edit-column');
    this.fieldListWrapper = this.get().getByTestId('nc-field-list-wrapper');
  }

  get() {
    return this.detailsPage.get().locator('.nc-fields-wrapper');
  }

  async clickNewField() {
    await this.addNewFieldButton.click();
    await this.addOrEditColumn.waitFor({ state: 'visible' });
  }

  async create({
    title,
    type = 'SingleLineText',
    formula = '',
    qrCodeValueColumnTitle = '',
    barcodeValueColumnTitle = '',
    barcodeFormat = '',
    childTable = '',
    childColumn = '',
    relationType = '',
    rollupType = '',
    format = '',
    dateFormat = '',
    timeFormat = '',
    insertAboveColumnTitle,
    insertBelowColumnTitle,
  }: {
    title: string;
    type?: string;
    formula?: string;
    qrCodeValueColumnTitle?: string;
    barcodeValueColumnTitle?: string;
    barcodeFormat?: string;
    childTable?: string;
    childColumn?: string;
    relationType?: string;
    rollupType?: string;
    format?: string;
    dateFormat?: string;
    timeFormat?: string;
    insertAboveColumnTitle?: string;
    insertBelowColumnTitle?: string;
  }) {
    if (insertAboveColumnTitle) {
      await this.grid.get().locator(`th[data-title="${insertBeforeColumnTitle}"] .nc-ui-dt-dropdown`).click();

      if (isDisplayValue) {
        await expect(this.rootPage.locator('li[role="menuitem"]:has-text("Insert Before")')).toHaveCount(0);
        return;
      }

      await this.rootPage.locator('li[role="menuitem"]:has-text("Insert Before"):visible').click();
    } else if (insertBelowColumnTitle) {
      await this.grid.get().locator(`th[data-title="${insertAfterColumnTitle}"] .nc-ui-dt-dropdown`).click();
      await this.rootPage.locator('li[role="menuitem"]:has-text("Insert After"):visible').click();
    } else {
      await this.clickNewField();
    }

    await this.addOrEditColumn.waitFor({ state: 'visible' });

    await this.fillTitle({ title });

    await this.selectType({ type });
    await this.rootPage.waitForTimeout(500);

    switch (type) {
      case 'SingleSelect':
      case 'MultiSelect':
        break;
      case 'Duration':
        if (format) {
          await this.get().locator('.ant-select-single').nth(1).click();
          await this.rootPage
            .locator(`.ant-select-item`, {
              hasText: format,
            })
            .click();
        }
        break;
      case 'Date':
        await this.get().locator('.nc-date-select').click();
        await this.rootPage.locator('.nc-date-select').pressSequentially(dateFormat);
        await this.rootPage.locator('.ant-select-item').locator(`text="${dateFormat}"`).click();
        break;
      case 'DateTime':
        // Date Format
        await this.get().locator('.nc-date-select').click();
        await this.rootPage.locator('.ant-select-item').locator(`text="${dateFormat}"`).click();
        // Time Format
        await this.get().locator('.nc-time-select').click();
        await this.rootPage.locator('.ant-select-item').locator(`text="${timeFormat}"`).click();
        break;
      case 'Formula':
        await this.get().locator('.nc-formula-input').fill(formula);
        break;
      case 'QrCode':
        await this.get().locator('.ant-select-single').nth(1).click();
        await this.rootPage
          .locator(`.ant-select-item`)
          .locator(`[data-testid="nc-qr-${qrCodeValueColumnTitle}"]`)
          .click();
        break;
      case 'Barcode':
        await this.get().locator('.ant-select-single').nth(1).click();
        await this.rootPage
          .locator(`.ant-select-item`, {
            hasText: new RegExp(`^${barcodeValueColumnTitle}$`),
          })
          .click();
        break;
      case 'Lookup':
        await this.get().locator('.ant-select-single').nth(1).click();
        await this.rootPage
          .locator(`.ant-select-item`, {
            hasText: childTable,
          })
          .click();
        await this.get().locator('.ant-select-single').nth(2).click();
        await this.rootPage
          .locator(`.ant-select-item`, {
            hasText: childColumn,
          })
          .last()
          .click();
        break;
      case 'Rollup':
        await this.get().locator('.ant-select-single').nth(1).click();
        await this.rootPage
          .locator(`.ant-select-item`, {
            hasText: childTable,
          })
          .click();
        await this.get().locator('.ant-select-single').nth(2).click();
        await this.rootPage
          .locator(`.nc-dropdown-relation-column >> .ant-select-item`, {
            hasText: childColumn,
          })
          .click();
        await this.get().locator('.ant-select-single').nth(3).click();
        await this.rootPage
          .locator(`.nc-dropdown-rollup-function >> .ant-select-item`, {
            hasText: rollupType,
          })
          .nth(0)
          .click();
        break;
      case 'Links':
        await this.get()
          .locator('.nc-ltar-relation-type >> .ant-radio')
          .nth(relationType === 'Has Many' ? 0 : 1)
          .click();
        await this.get().locator('.ant-select-single').nth(1).click();
        await this.rootPage.locator(`.nc-ltar-child-table >> input[type="search"]`).fill(childTable);
        await this.rootPage
          .locator(`.nc-dropdown-ltar-child-table >> .ant-select-item`, {
            hasText: childTable,
          })
          .nth(0)
          .click();
        break;
      case 'User':
        break;
      default:
        break;
    }

    await this.saveChanges();

    const headersText = [];
    const locator = this.grid.get().locator(`th`);
    const count = await locator.count();
    for (let i = 0; i < count; i++) {
      const header = locator.nth(i);
      const text = await getTextExcludeIconText(header);
      headersText.push(text);
    }

    // verify column inserted after the target column
    if (insertAboveColumnTitle) {
      expect(headersText[headersText.findIndex(title => title.startsWith(insertAboveColumnTitle)) + 1]).toBe(title);
    }

    // verify column inserted before the target column
    if (insertBelowColumnTitle) {
      expect(headersText[headersText.findIndex(title => title.startsWith(insertAboveColumnTitle)) - 1]).toBe(title);
    }
  }

  async fillTitle({ title }: { title: string }) {
    const fieldTitleInput = this.get().locator('.nc-fields-input');
    await fieldTitleInput.click();
    await fieldTitleInput.fill(title);
  }

  async selectType({ type }: { type: string }) {
    await this.get().locator('.ant-select-selector > .ant-select-selection-item').click();

    await this.get().locator('.ant-select-selection-search-input[aria-expanded="true"]').waitFor();
    await this.get().locator('.ant-select-selection-search-input[aria-expanded="true"]').fill(type);

    // Select column type
    await this.rootPage.locator('.rc-virtual-list-holder-inner > div').locator(`text="${type}"`).click();
  }

  async saveChanges() {
    await this.waitForResponse({
      uiAction: async () => await this.saveChangesButton.click(),
      requestUrlPathToMatch: 'api/v1/db/meta/tables/',
      httpMethodsToMatch: ['POST'],
      responseJsonMatcher: json => json['failedOps']?.length === 0,
    });
  }

  async getField({ title }: { title: string }) {
    return this.fieldListWrapper.locator('> div').locator(`text=${title}`);
  }
}
