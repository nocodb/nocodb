import { expect } from '@playwright/test';
import { CellPageObject } from '.';
import BasePage from '../../../Base';

export class UserOptionCellPageObject extends BasePage {
  readonly cell: CellPageObject;

  constructor(cell: CellPageObject) {
    super(cell.rootPage);
    this.cell = cell;
  }

  get({ index, columnHeader }: { index: number; columnHeader: string }) {
    return this.cell.get({ index, columnHeader });
  }

  async select({
    index,
    columnHeader,
    option,
    multiSelect,
  }: {
    index: number;
    columnHeader: string;
    option: string;
    multiSelect?: boolean;
  }) {
    const selectCell = this.get({ index, columnHeader });

    // check if cell active
    if (
      !(await selectCell.getAttribute('class')).includes('active') &&
      (await selectCell.locator('.nc-selected-option').count()) === 0
    ) {
      await selectCell.click();
    }

    await selectCell.click();

    await this.rootPage.locator('.nc-dropdown-user-select-cell.active').waitFor({ state: 'visible' });

    if (index === -1) {
      const selectOption = this.rootPage.getByTestId(`select-option-${columnHeader}-undefined`).getByText(option);
      await selectOption.scrollIntoViewIfNeeded();
      await selectOption.click();
    } else {
      const selectOption = this.rootPage.getByTestId(`select-option-${columnHeader}-${index}`).getByText(option);
      await selectOption.scrollIntoViewIfNeeded();
      await selectOption.click();
    }

    if (multiSelect) {
      // Press `Escape` to close the dropdown
      await this.rootPage.keyboard.press('Escape');
    }

    await this.rootPage.locator('.nc-dropdown-user-select-cell.active').waitFor({ state: 'hidden' });
  }

  async clear({ index, columnHeader, multiSelect }: { index: number; columnHeader: string; multiSelect?: boolean }) {
    if (multiSelect) {
      await this.cell.get({ index, columnHeader }).click();
      await this.cell.get({ index, columnHeader }).click();

      const optionCount = await this.cell.get({ index, columnHeader }).locator('.ant-tag').count();

      for (let i = 0; i < optionCount; i++) {
        await this.cell.get({ index, columnHeader }).locator('.ant-tag > .ant-tag-close-icon').first().click();
        // wait till number of options is less than before
        await this.cell
          .get({ index, columnHeader })
          .locator('.ant-tag')
          .nth(optionCount - i - 1)
          .waitFor({ state: 'hidden' });
      }
      return;
    }

    await this.get({ index, columnHeader }).click();
    await this.rootPage.locator('.ant-tag > .ant-tag-close-icon').click();

    // Press `Escape` to close the dropdown
    await this.rootPage.keyboard.press('Escape');
    await this.rootPage.locator('.nc-dropdown-user-select-cell.active').waitFor({ state: 'hidden' });
  }

  async verify({
    index = 0,
    columnHeader,
    option,
    multiSelect,
  }: {
    index?: number;
    columnHeader: string;
    option: string;
    multiSelect?: boolean;
  }) {
    if (multiSelect) {
      return await expect(this.cell.get({ index, columnHeader })).toContainText(option, { useInnerText: true });
    }

    const locator = this.cell.get({ index, columnHeader }).locator('.ant-tag');
    await expect(locator).toBeVisible();
    return expect(locator).toContainText(option);
  }

  async verifyNoOptionsSelected({ index, columnHeader }: { index: number; columnHeader: string }) {
    return await expect(
      this.cell.get({ index, columnHeader }).locator('.ant-select-selection-overflow-item >> .ant-tag')
    ).toBeHidden();
  }

  async verifyOptions({
    index = 0,
    columnHeader,
    options,
  }: {
    index?: number;
    columnHeader: string;
    options: string[];
  }) {
    const selectCell = this.get({ index, columnHeader });

    // check if cell active
    // drag based non-primary cell will have 'active' attribute
    // primary cell with blue border will have 'active-cell' attribute
    if (!(await selectCell.getAttribute('class')).includes('active-cell')) {
      await selectCell.click();
    }

    await this.get({ index, columnHeader }).click();
    await this.rootPage.waitForTimeout(500);

    let counter = 0;
    for (const option of options) {
      await expect(this.rootPage.locator(`div.ant-select-item-option`).nth(counter)).toContainText(option);
      counter++;
    }
    await this.rootPage.keyboard.press('Escape');
    await this.rootPage.locator(`.nc-dropdown-user-select-cell`).nth(index).waitFor({ state: 'hidden' });
  }

  async verifySelectedOptions({
    index,
    options,
    columnHeader,
  }: {
    columnHeader: string;
    options: string[];
    index: number;
  }) {
    const selectCell = this.get({ index, columnHeader });
    await selectCell.click();

    let counter = 0;
    for (const option of options) {
      await expect(selectCell.locator(`.nc-selected-option`).nth(counter)).toContainText(option);
      counter++;
    }
  }
}
