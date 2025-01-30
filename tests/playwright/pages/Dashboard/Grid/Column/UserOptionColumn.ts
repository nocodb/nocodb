import { ColumnPageObject } from '.';
import BasePage from '../../../Base';
import { expect } from '@playwright/test';

export class UserOptionColumnPageObject extends BasePage {
  readonly column: ColumnPageObject;

  constructor(column: ColumnPageObject) {
    super(column.rootPage);
    this.column = column;
  }

  get() {
    return this.column.get();
  }

  async allowMultipleUser({
    columnTitle,
    allowMultiple = false,
  }: {
    columnTitle: string;
    allowMultiple?: boolean;
  }): Promise<void> {
    await this.column.openEdit({ title: columnTitle });
    const checkbox = this.get().getByTestId('user-column-allow-multiple');
    const isChecked = await checkbox.isChecked();

    if ((isChecked && !allowMultiple) || (!isChecked && allowMultiple)) {
      await checkbox.click();
    }
    await this.column.save({ isUpdated: true });
  }

  async selectDefaultValueOption({
    columnTitle,
    option,
    multiSelect,
  }: {
    columnTitle: string;
    option: string | string[];
    multiSelect?: boolean;
  }): Promise<void> {
    // Verify allow multiple checkbox before selecting default value
    await this.allowMultipleUser({ columnTitle, allowMultiple: multiSelect });

    await this.column.openEdit({ title: columnTitle });

    // Clear previous default value
    await this.clearDefaultValue();

    const selector = this.column.get().locator('.nc-user-select >> .ant-select-selector');
    await selector.click();

    await this.rootPage.locator('.nc-dropdown-user-select-cell.active').waitFor({ state: 'visible' });

    if (multiSelect) {
      const optionsToSelect = Array.isArray(option) ? option : [option];

      for (const op of optionsToSelect) {
        await this.selectOption({ option: op });
      }

      // Press `Escape` to close the dropdown
      await this.rootPage.keyboard.press('Escape');
    } else if (!Array.isArray(option)) {
      await this.selectOption({ option });
    }

    await this.rootPage.locator('.nc-dropdown-user-select-cell.active').waitFor({ state: 'hidden' });

    await this.column.save({ isUpdated: true });
  }

  async selectOption({ option }: { option: string }) {
    await this.get().locator('.ant-select-selection-search-input[aria-expanded="true"]').waitFor();
    await this.get().locator('.ant-select-selection-search-input[aria-expanded="true"]').fill(option);

    // Select user option
    await this.rootPage.locator('.rc-virtual-list-holder-inner > div').locator(`text="${option}"`).click();
  }

  async clearDefaultValue(): Promise<void> {
    await this.get().locator('.nc-default-value-wrapper > svg.nc-icon').click();
  }

  async verifyDefaultValueOptionCount({
    columnTitle,
    totalCount,
  }: {
    columnTitle: string;
    totalCount: number;
  }): Promise<void> {
    await this.column.openEdit({ title: columnTitle });

    await this.column.get().locator('.nc-default-value-wrapper > .relative > .nc-cell-user').click();

    await this.rootPage.locator('.nc-dropdown-user-select-cell.active').waitFor({ state: 'visible' });

    expect(await this.rootPage.getByTestId(`select-option-${columnTitle}-undefined`).count()).toEqual(totalCount);
    await this.column.get().locator('.nc-cell-user').click();

    // Press `Cancel` to close edit modal
    await this.column.get().locator('button:has-text("Cancel")').click();
    await this.get().waitFor({ state: 'hidden' });
  }

  async verifySelectedOptions({ options, columnHeader }: { columnHeader: string; options: string[] }) {
    await this.column.openEdit({ title: columnHeader });

    const defaultValueSelector = this.get().locator('.nc-user-select >> .ant-select-selector');

    let counter = 0;
    for (const option of options) {
      await expect(defaultValueSelector.locator(`.nc-selected-option`).nth(counter)).toContainText(option);
      counter++;
    }

    // Press `Cancel` to close edit modal
    await this.column.get().locator('button:has-text("Cancel")').click();
    await this.get().waitFor({ state: 'hidden' });
  }
}
