// Fields

import BasePage from '../../Base';
import { expect, Locator } from '@playwright/test';
import { DetailsPage } from './index';
import { UITypes } from 'nocodb-sdk';

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

  async fillSearch({ title }: { title: string }) {
    const searchInput = this.get().getByTestId('nc-field-search-input');
    await searchInput.click();
    await searchInput.fill(title);
  }

  async clearSearch() {
    await this.get().getByTestId('nc-field-clear-search').click();
  }

  async clickNewField() {
    await this.addNewFieldButton.click();
  }

  async clickRestoreField({ title }: { title: string }) {
    await this.getField({ title }).getByTestId('nc-field-restore-changes').click();
  }

  defaultValueBtn() {
    const showDefautlValueBtn = this.addOrEditColumn.getByTestId('nc-show-default-value-btn');

    return {
      locator: showDefautlValueBtn,
      isVisible: async () => {
        return await showDefautlValueBtn.isVisible();
      },
      click: async () => {
        if (await showDefautlValueBtn.isVisible()) {
          await showDefautlValueBtn.waitFor();
          await showDefautlValueBtn.click({ force: true });

          await showDefautlValueBtn.waitFor({ state: 'hidden' });
          await this.addOrEditColumn.locator('.nc-default-value-wrapper').waitFor({ state: 'visible' });
        }
      },
    };
  }

  async createOrUpdate({
    title,
    type = UITypes.SingleLineText,
    isUpdateMode = false,
    saveChanges = true,
    formula = '',
    qrCodeValueColumnTitle = '',
    barcodeValueColumnTitle = '',
    barcodeFormat = '',
    childTable = '',
    childColumn = '',
    relationType = '',
    rollupType = '',
    format = '',
    dateFormat = 'YYYY-MM-DD',
    timeFormat = 'HH:mm',
    insertAboveColumnTitle,
    insertBelowColumnTitle,
  }: {
    title: string;
    type?: UITypes;
    isUpdateMode?: boolean;
    saveChanges?: boolean;
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
    if (!isUpdateMode) {
      if (insertAboveColumnTitle) {
        await this.selectFieldAction({ title: insertAboveColumnTitle, action: 'insert-above' });
      } else if (insertBelowColumnTitle) {
        await this.selectFieldAction({ title: insertBelowColumnTitle, action: 'insert-below' });
      } else {
        await this.clickNewField();
      }
    }
    await this.addOrEditColumn.waitFor({ state: 'visible' });

    await this.fillTitle({ title });

    await this.selectType({ type });
    await this.rootPage.waitForTimeout(500);

    // Click set default value to show default value input, on close field modal it will automacally hide input if value is not set
    await this.defaultValueBtn().click();

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
        await this.addOrEditColumn.locator('.nc-ltar-relation-type').getByTestId(relationType).click();
        // await this.addOrEditColumn
        //   .locator('.nc-ltar-relation-type >> .ant-radio')
        //   .nth(relationType === 'Has Many' ? 1 : 0)
        //   .click();
        await this.addOrEditColumn.locator('.ant-select-single').nth(1).click();
        await this.rootPage.locator(`.nc-ltar-child-table >> input[type="search"]`).first().fill(childTable);
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

    if (saveChanges) {
      await this.saveChanges();

      const fieldsText = await this.getAllFieldText();

      if (insertAboveColumnTitle) {
        // verify field inserted above the target field
        expect(fieldsText[fieldsText.findIndex(title => title.startsWith(insertAboveColumnTitle)) - 1]).toBe(title);
      } else if (insertBelowColumnTitle) {
        // verify field inserted below the target field
        expect(fieldsText[fieldsText.findIndex(title => title.startsWith(insertBelowColumnTitle)) + 1]).toBe(title);
      } else {
        // verify field inserted at the end
        expect(fieldsText[fieldsText.length - 1]).toBe(title);
      }
    }
  }

  async fillTitle({ title }: { title: string }) {
    const fieldTitleInput = this.addOrEditColumn.locator('.nc-fields-input');
    await fieldTitleInput.click();
    await fieldTitleInput.fill(title);
  }

  async selectType({ type }: { type: string }) {
    if (await this.addOrEditColumn.getByTestId('nc-column-uitypes-options-list-wrapper').isVisible()) {
      const searchInput = this.addOrEditColumn.locator('.nc-column-type-search-input >> input');

      await searchInput.waitFor({ state: 'visible' });

      await searchInput.click();
      await searchInput.fill(type);

      await this.addOrEditColumn.locator('.nc-column-list-wrapper').getByTestId(type).waitFor();
      await this.addOrEditColumn.locator('.nc-column-list-wrapper').getByTestId(type).click();

      await this.addOrEditColumn.locator('.nc-column-type-input').waitFor();
    } else {
      await this.addOrEditColumn.locator('.ant-select-selector > .ant-select-selection-item').click();

      await this.addOrEditColumn.locator('.ant-select-selection-search-input[aria-expanded="true"]').waitFor();
      await this.addOrEditColumn.locator('.ant-select-selection-search-input[aria-expanded="true"]').fill(type);

      // Select column type
      await this.rootPage.locator('.rc-virtual-list-holder-inner > div').getByTestId(type).click();
    }
  }

  async saveChanges() {
    // allow the changes triggered earlier (toggle visibility, etc) to settle
    await this.rootPage.waitForTimeout(1000);

    await this.waitForResponse({
      uiAction: async () => await this.saveChangesButton.click(),
      requestUrlPathToMatch: 'api/v1/db/meta/tables/',
      httpMethodsToMatch: ['GET'],
      responseJsonMatcher: json => json['hash'],
    });
    await this.rootPage.waitForTimeout(1000);
  }

  getField({ title }: { title: string }) {
    return this.fieldListWrapper.getByTestId(`nc-field-item-${title}`);
  }

  async getFieldVisibilityCheckbox({ title }: { title: string }) {
    return this.getField({ title }).getByTestId('nc-field-visibility-checkbox');
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
    const field = this.getField({ title });
    await field.scrollIntoViewIfNeeded();

    await field.hover();
    // await field.getByTestId('nc-field-item-action-button').waitFor({ state: 'visible' });
    await field.getByTestId('nc-field-item-action-button').click();

    const fieldActionDropdown = isDisplayValueField
      ? this.rootPage.locator('.nc-field-item-action-dropdown-display-column')
      : this.rootPage.locator('.nc-field-item-action-dropdown');

    await fieldActionDropdown.waitFor({ state: 'visible' });
    await fieldActionDropdown.getByTestId(`nc-field-item-action-${action}`).click();

    if (action === 'copy-id') {
      await field.getByTestId('nc-field-item-action-button').click({
        force: true,
      });
    }

    await fieldActionDropdown.waitFor({ state: 'hidden' });
  }

  async getAllFieldText() {
    const fieldsText = [];
    const locator = this.fieldListWrapper.locator('>div');
    const count = await locator.count();
    for (let i = 0; i < count; i++) {
      await locator.nth(i).scrollIntoViewIfNeeded();
      const text = await locator.nth(i).getByTestId('nc-field-title').textContent();
      fieldsText.push(text);
    }
    return fieldsText;
  }

  async getFieldId({ title, isDisplayValueField = false }: { title: string; isDisplayValueField?: boolean }) {
    const field = this.getField({ title });
    await field.scrollIntoViewIfNeeded();

    await field.hover();
    await field.getByTestId('nc-field-item-action-button').waitFor({ state: 'visible' });
    await field.getByTestId('nc-field-item-action-button').click();

    const fieldActionDropdown = isDisplayValueField
      ? this.rootPage.locator('.nc-field-item-action-dropdown-display-column')
      : this.rootPage.locator('.nc-field-item-action-dropdown');

    await fieldActionDropdown.waitFor({ state: 'visible' });
    const fieldId = await fieldActionDropdown.getByTestId('nc-field-item-action-copy-id').innerText();
    await field.getByTestId('nc-field-item-action-button').click();
    await fieldActionDropdown.waitFor({ state: 'hidden' });

    return fieldId.split(':')[1]?.trim() || '';
  }
}
