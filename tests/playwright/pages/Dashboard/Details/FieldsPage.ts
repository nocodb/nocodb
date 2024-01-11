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
      await this.selectFieldAction({ title: insertAboveColumnTitle, action: 'insert-above' });
    } else if (insertBelowColumnTitle) {
      await this.selectFieldAction({ title: insertBelowColumnTitle, action: 'insert-below' });
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
          await this.addOrEditColumn.locator('.ant-select-single').nth(1).click();
          await this.rootPage
            .locator(`.ant-select-item`, {
              hasText: format,
            })
            .click();
        }
        break;
      case 'Date':
        await this.addOrEditColumn.locator('.nc-date-select').click();
        await this.rootPage.locator('.nc-date-select').pressSequentially(dateFormat);
        await this.rootPage.locator('.ant-select-item').locator(`text="${dateFormat}"`).click();
        break;
      case 'DateTime':
        // Date Format
        await this.addOrEditColumn.locator('.nc-date-select').click();
        await this.rootPage.locator('.ant-select-item').locator(`text="${dateFormat}"`).click();
        // Time Format
        await this.addOrEditColumn.locator('.nc-time-select').click();
        await this.rootPage.locator('.ant-select-item').locator(`text="${timeFormat}"`).click();
        break;
      case 'Formula':
        await this.addOrEditColumn.locator('.nc-formula-input').fill(formula);
        break;
      case 'QrCode':
        await this.addOrEditColumn.locator('.ant-select-single').nth(1).click();
        await this.rootPage
          .locator(`.ant-select-item`)
          .locator(`[data-testid="nc-qr-${qrCodeValueColumnTitle}"]`)
          .click();
        break;
      case 'Barcode':
        await this.addOrEditColumn.locator('.ant-select-single').nth(1).click();
        await this.rootPage
          .locator(`.ant-select-item`, {
            hasText: new RegExp(`^${barcodeValueColumnTitle}$`),
          })
          .click();
        break;
      case 'Lookup':
        await this.addOrEditColumn.locator('.ant-select-single').nth(1).click();
        await this.rootPage
          .locator(`.ant-select-item`, {
            hasText: childTable,
          })
          .click();
        await this.addOrEditColumn.locator('.ant-select-single').nth(2).click();
        await this.rootPage
          .locator(`.ant-select-item`, {
            hasText: childColumn,
          })
          .last()
          .click();
        break;
      case 'Rollup':
        await this.addOrEditColumn.locator('.ant-select-single').nth(1).click();
        await this.rootPage
          .locator(`.ant-select-item`, {
            hasText: childTable,
          })
          .click();
        await this.addOrEditColumn.locator('.ant-select-single').nth(2).click();
        await this.rootPage
          .locator(`.nc-dropdown-relation-column >> .ant-select-item`, {
            hasText: childColumn,
          })
          .click();
        await this.addOrEditColumn.locator('.ant-select-single').nth(3).click();
        await this.rootPage
          .locator(`.nc-dropdown-rollup-function >> .ant-select-item`, {
            hasText: rollupType,
          })
          .nth(0)
          .click();
        break;
      case 'Links':
        await this.addOrEditColumn
          .locator('.nc-ltar-relation-type >> .ant-radio')
          .nth(relationType === 'Has Many' ? 0 : 1)
          .click();
        await this.addOrEditColumn.locator('.ant-select-single').nth(1).click();
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

    const fieldsText = [];
    const locator = this.fieldListWrapper.locator('>div');
    const count = await locator.count();
    for (let i = 0; i < count; i++) {
      const text = await locator.nth(i).getByTestId('nc-field-title').textContent();
      fieldsText.push(text);
    }

    // verify field inserted above the target field
    if (insertAboveColumnTitle) {
      expect(fieldsText[fieldsText.findIndex(title => title.startsWith(insertAboveColumnTitle)) - 1]).toBe(title);
    }

    // verify field inserted below the target field
    if (insertBelowColumnTitle) {
      expect(fieldsText[fieldsText.findIndex(title => title.startsWith(insertAboveColumnTitle)) + 1]).toBe(title);
    }
  }

  async fillTitle({ title }: { title: string }) {
    const fieldTitleInput = this.addOrEditColumn.locator('.nc-fields-input');
    await fieldTitleInput.click();
    await fieldTitleInput.fill(title);
  }

  async selectType({ type }: { type: string }) {
    await this.addOrEditColumn.locator('.ant-select-selector > .ant-select-selection-item').click();

    await this.addOrEditColumn.locator('.ant-select-selection-search-input[aria-expanded="true"]').waitFor();
    await this.addOrEditColumn.locator('.ant-select-selection-search-input[aria-expanded="true"]').fill(type);

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
    return this.fieldListWrapper.getByTestId('nc-field-title').locator(`text=${title}`);
  }

  async getFieldVisibilityCheckbox({ title }: { title: string }) {
    return (await this.getField({ title })).getByTestId('nc-field-visibility-checkbox');
  }

  async selectFieldAction({
    title,
    action,
    isDisplayValueField = false,
  }: {
    title: string;
    action: 'copy-id' | 'duplicate' | 'insert-above' | 'insert-below' | 'delete';
    isDisplayValueField?: boolean;
  }) {
    const field = await this.getField({ title });

    await field.hover();
    await field.getByTestId('nc-field-item-action-button').waitFor({ state: 'visible' });
    await field.getByTestId('nc-field-item-action-button').click();

    const fieldActionDropdown = isDisplayValueField
      ? this.rootPage.locator('.nc-field-item-action-dropdown-display-column')
      : this.rootPage.locator('.nc-field-item-action-dropdown');

    await fieldActionDropdown.waitFor({ state: 'visible' });
    await fieldActionDropdown.getByTestId(`nc-field-item-action-${action}`).click();
    await fieldActionDropdown.waitFor({ state: 'hidden' });
  }
}
