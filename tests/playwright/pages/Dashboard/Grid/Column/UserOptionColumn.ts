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

  async allowMultipleUser({ columnTitle, allowMultiple = false }: { columnTitle: string; allowMultiple?: boolean }) {
    await this.column.openEdit({ title: columnTitle });
    const checkbox = this.get().locator('[data-testid="user-column-allow-multiple"]');
    const isChecked = await checkbox.isChecked();

    if ((isChecked && !allowMultiple) || (!isChecked && allowMultiple)) {
      await checkbox.click();
    }
    await this.rootPage.waitForTimeout(5000);
    await this.column.save({ isUpdated: true });
  }

  async verifyDefaultValueOptions({ columnTitle, totalCount }: { columnTitle: string; totalCount: number }) {
    await this.column.openEdit({ title: columnTitle });

    await this.column.get().locator('.nc-cell-user').click();

    const userDropdown = this.get().locator('[data-testid="select-option-User-undefined"]');
    await userDropdown.waitFor({ state: 'visible' });
    console.log('userDropdown::::', userDropdown);

    await expect(userDropdown).toHaveCount(totalCount);
    await this.column.get().locator('.nc-cell-user').click();
    await this.column.save({ isUpdated: true });
  }
  async clearDefaultValueOptions({ columnTitle }: { columnTitle: string }) {
    await this.column.openEdit({ title: columnTitle });

    await this.column.get().locator('.nc-cell-user + svg').click();
  }
}
